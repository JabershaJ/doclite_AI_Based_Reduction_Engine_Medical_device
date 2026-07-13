import { writeFileSync } from 'node:fs'
import { Agent as HttpsAgent } from 'node:https'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const APIM_BASE = 'https://apim-foundry-prod-ltts.azure-api.net'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // APIM_KEY deliberately has no VITE_ prefix: it stays server-side (proxy only)
  // and is never bundled into the browser. See .env.example.
  const env = loadEnv(mode, process.cwd(), '')
  let apimKey = env.APIM_KEY ?? ''

  function persist(key: string) {
    try {
      writeFileSync(
        path.join(process.cwd(), '.env'),
        `# Copy to .env and paste the APIM subscription key you receive on hackathon day.\n` +
          `# The key stays server-side: vite.config.ts injects it into proxied /llm requests.\n` +
          `# It is NOT prefixed with VITE_ on purpose — never expose it to the browser bundle.\n` +
          `# Restart \`npm run dev\` after changing this file by hand.\n` +
          `# (Also updated automatically when the key is set from the AgentDock UI.)\n` +
          `APIM_KEY=${key}\n`
      )
    } catch {
      /* best-effort — the runtime key still works for this session even if the write fails */
    }
  }

  // Dev-only: lets the AgentDock UI set/clear the APIM key at runtime, no restart needed.
  // The key still never reaches the browser bundle — it's POSTed once, held here in the
  // Node process, validated against APIM, and used only to inject the proxy's api-key header.
  const apimKeyRuntimePlugin: Plugin = {
    name: 'apim-key-runtime',
    configureServer(server) {
      server.middlewares.use('/__apim-key', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ live: Boolean(apimKey) }))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          void (async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const { key } = JSON.parse(body || '{}') as { key?: string }
              const trimmed = (key ?? '').trim()
              if (!trimmed) {
                apimKey = ''
                persist('')
                res.end(JSON.stringify({ live: false }))
                return
              }
              const check = await fetch(`${APIM_BASE}/gpt5-mini/deployments/gpt-5-mini/chat/completions?api-version=2024-12-01-preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api-key': trimmed },
                body: JSON.stringify({ messages: [{ role: 'user', content: 'ok' }], max_completion_tokens: 5 }),
              })
              if (!check.ok) {
                res.statusCode = 400
                res.end(JSON.stringify({ live: false, error: `APIM rejected the key (HTTP ${check.status}).` }))
                return
              }
              apimKey = trimmed
              persist(trimmed)
              res.end(JSON.stringify({ live: true }))
            } catch (e) {
              res.statusCode = 400
              res.end(JSON.stringify({ live: false, error: e instanceof Error ? e.message : 'Invalid request.' }))
            }
          })()
        })
      })
    },
  }

  return {
    plugins: [react(), apimKeyRuntimePlugin],
    define: {
      // Initial value only — AgentDock re-checks /__apim-key at runtime so UI-set keys
      // take effect without a rebuild.
      'import.meta.env.VITE_LLM_LIVE': JSON.stringify(apimKey ? 'true' : 'false'),
    },
    server: {
      watch: {
        // Archives/exports created in the project folder (e.g. doclite.zip) crash the
        // file watcher with EBUSY on Windows while being written — don't watch them.
        ignored: ['**/*.zip', '**/*.pptx', '**/*.pdf', '**/*.png'],
      },
      proxy: {
        // Browser calls /llm/... → proxied to APIM with the key injected here, read live
        // on every request so a runtime key change applies immediately.
        '/llm': {
          target: APIM_BASE,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/llm/, ''),
          // Keep-alive: reuse established TLS connections to APIM. Fresh TCP connects to
          // the gateway intermittently time out on hackathon networks; a warm socket avoids
          // most of them (client.ts retries the rest).
          agent: new HttpsAgent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 8 }),
          proxyTimeout: 120000,
          configure: (proxy) => {
            const started = new WeakMap<object, number>()
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.setHeader('api-key', apimKey)
              started.set(req, Date.now())
              const route = (req.url ?? '').match(/^\/(gpt[^/]+)/)?.[1] ?? req.url
              console.log(`  [llm] → ${route}  (${new Date().toLocaleTimeString()})`)
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              const ms = started.has(req) ? Date.now() - (started.get(req) as number) : NaN
              const route = (req.url ?? '').match(/^\/(gpt[^/]+)/)?.[1] ?? req.url
              const status = proxyRes.statusCode ?? 0
              const mark = status < 400 ? '✓' : '✗'
              console.log(`  [llm] ${mark} ${route}  HTTP ${status}  ${Number.isNaN(ms) ? '' : ms + 'ms'}`)
            })
          },
        },
      },
    },
  }
})
