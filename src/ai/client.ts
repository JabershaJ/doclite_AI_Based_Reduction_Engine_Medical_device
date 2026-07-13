/**
 * LLM client for the hackathon's Azure APIM endpoints
 * (apim-foundry-prod-ltts.azure-api.net — see "5. APIM-Foundry-Hackathon-Endpoint-URL-Guide").
 *
 * The browser never talks to APIM directly and never sees the key:
 * calls go to a relative /llm/... path, and the Vite dev-server proxy
 * (vite.config.ts) forwards them to APIM injecting the `api-key` header
 * from the APIM_KEY entry in .env. This solves CORS and complies with the
 * hackathon security guideline "do not hardcode keys / do not expose keys".
 *
 * No APIM_KEY in .env → LLM_LIVE is false → every agent falls back to its
 * offline mock (agents.ts), so the demo path never breaks.
 */

let live = import.meta.env.VITE_LLM_LIVE === 'true'

/** Current live/mock status. Reflects runtime key changes made via the AgentDock UI, not just the build-time flag. */
export function isLive(): boolean {
  return live
}

/** Re-checks the dev-server proxy for the current key status — picks up changes made from another tab/session. */
export async function refreshLiveStatus(): Promise<boolean> {
  try {
    const res = await fetch('/__apim-key')
    if (res.ok) live = Boolean((await res.json()).live)
  } catch {
    /* keep last known status */
  }
  return live
}

/**
 * Dev-only: submit a new APIM key to the Vite dev-server proxy at runtime — no restart
 * needed. The key is validated against APIM before being accepted. Pass '' to clear it
 * and fall back to mock mode. Returns null on success, or an error message.
 */
export async function submitApimKey(key: string): Promise<string | null> {
  const res = await fetch('/__apim-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  })
  const data = await res.json().catch(() => ({}) as { live?: boolean; error?: string })
  live = Boolean(data.live)
  return res.ok ? null : data.error ?? `Request failed (${res.status}).`
}

/** Model routing per the endpoint guide: 5.4 = reasoning/extraction/vision, 5.2 = report writing, mini = fast/cheap. */
export type ModelRoute = 'gpt54' | 'gpt52' | 'mini'

const ROUTES: Record<ModelRoute, string> = {
  gpt54: '/llm/gpt54/deployments/gpt-5.4/chat/completions?api-version=2024-12-01-preview',
  gpt52: '/llm/gpt52/deployments/gpt-5.2/chat/completions?api-version=2024-12-01-preview',
  mini: '/llm/gpt5-mini/deployments/gpt-5-mini/chat/completions?api-version=2024-12-01-preview',
}

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
interface ChatMessage {
  role: 'system' | 'user'
  content: string | ContentPart[]
}

/** Gateway/connectivity failures worth retrying — not model errors like 400/401. */
const RETRYABLE_STATUS = new Set([502, 503, 504, 429])

async function chat(route: ModelRoute, body: Record<string, unknown>): Promise<string> {
  const payload = JSON.stringify(body)
  let lastError: Error = new Error('LLM call failed.')
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt))
    let res: Response
    try {
      res = await fetch(ROUTES[route], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
    } catch (e) {
      // Network-level failure (connection reset/timeout) — retry.
      lastError = e instanceof Error ? e : new Error(String(e))
      continue
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      lastError = new Error(`LLM call failed (${res.status}): ${detail}`)
      if (RETRYABLE_STATUS.has(res.status)) continue
      throw lastError
    }
    const data = await res.json()
    const content: unknown = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content) throw new Error('Empty LLM response.')
    return content
  }
  throw lastError
}

/** Strip markdown fences if the model wrapped the JSON despite instructions. */
function parseJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(cleaned) as T
}

/**
 * One structured-output call. Tries Azure OpenAI response_format json_schema
 * first; if the deployment rejects it (400), retries with prompt-enforced JSON.
 */
export async function structuredCall<T>(
  system: string,
  user: string | ContentPart[],
  schema: Record<string, unknown>,
  opts: { route?: ModelRoute; maxTokens?: number } = {}
): Promise<T> {
  const { route = 'gpt54', maxTokens = 4096 } = opts
  const messages: ChatMessage[] = [
    { role: 'system', content: `${system}\n\nRespond with a single JSON object matching the required schema — no prose, no markdown fences.` },
    { role: 'user', content: user },
  ]
  try {
    const text = await chat(route, {
      messages,
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } },
    })
    return parseJson<T>(text)
  } catch (e) {
    // Fallback: some deployments/API versions reject response_format — rely on the prompt.
    if (e instanceof Error && /400/.test(e.message)) {
      const text = await chat(route, { messages, max_completion_tokens: maxTokens })
      return parseJson<T>(text)
    }
    throw e
  }
}

/** Structured call with an attached image (GPT-5.4 vision/OCR). Accepts a data: URL. */
export async function visionCall<T>(system: string, instruction: string, imageDataUrl: string, schema: Record<string, unknown>): Promise<T> {
  return structuredCall<T>(
    system,
    [
      { type: 'text', text: instruction },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
    schema,
    { route: 'gpt54', maxTokens: 4096 }
  )
}
