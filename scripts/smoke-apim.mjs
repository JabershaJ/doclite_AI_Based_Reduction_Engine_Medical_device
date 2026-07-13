/**
 * Day-0 smoke test for the hackathon APIM endpoints.
 * Usage:  node scripts/smoke-apim.mjs            (reads APIM_KEY from .env)
 *         node scripts/smoke-apim.mjs <key>      (key as argument)
 * Validates each deployment the app uses before you touch the UI.
 */
import { readFileSync } from 'node:fs'

let key = process.argv[2]
if (!key) {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    key = env.match(/^APIM_KEY=(.+)$/m)?.[1]?.trim()
  } catch {
    /* no .env */
  }
}
if (!key) {
  console.error('No key. Put APIM_KEY=... in .env or pass it as an argument.')
  process.exit(1)
}

const BASE = 'https://apim-foundry-prod-ltts.azure-api.net'
const TESTS = [
  ['GPT-5.4 (intake/auditor/OCR)', `${BASE}/gpt54/deployments/gpt-5.4/chat/completions?api-version=2024-12-01-preview`],
  ['GPT-5.2 (narrator)', `${BASE}/gpt52/deployments/gpt-5.2/chat/completions?api-version=2024-12-01-preview`],
  ['GPT-5 Mini (spare)', `${BASE}/gpt5-mini/deployments/gpt-5-mini/chat/completions?api-version=2024-12-01-preview`],
]

let failures = 0
for (const [label, url] of TESTS) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with the single word: ok' }], max_completion_tokens: 10 }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`)
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? '(no content)'
    console.log(`PASS  ${label.padEnd(32)} → "${String(text).trim().slice(0, 40)}"`)
  } catch (e) {
    failures++
    console.log(`FAIL  ${label.padEnd(32)} → ${e.message}`)
  }
}
console.log(failures === 0 ? '\nAll endpoints live — set the same key in .env and restart npm run dev.' : `\n${failures} endpoint(s) failed — check the key or contact the IT SPOC.`)
process.exit(failures === 0 ? 0 : 1)
