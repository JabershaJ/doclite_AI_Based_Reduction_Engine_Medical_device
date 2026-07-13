# DocLite — AI-Powered Risk-Based Documentation Reduction Engine

 Classifies medical device risk under EU MDR 2017/745
Annex VIII, then generates the *minimal compliant documentation set* — with every
Required / Conditional / **Eliminated** decision justified by a clause citation
(EU MDR annex/article, ISO 13485:2016 clause, FDA QMSR reference).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npx tsx scripts/verify.ts   # regression-check the 5 demo devices
```

## Architecture

```
src/engine/types.ts           domain model (device profile, classification, checklist)
src/engine/classify.ts        deterministic MDR Annex VIII rules engine (Rules 1–14 subset)
src/engine/knowledgeBase.ts   52 artifacts mapped to ISO 13485 / MDR annexes / FDA QMSR
src/engine/filter.ts          three-bucket filtering + savings metric
src/data/presets.ts           5 pre-verified demo devices (Class I → III)
src/App.tsx                   intake form, classification card, checklist, traceability, export
```

Design decision: the classifier and filter are **fully deterministic** — the demo works
offline with zero API dependencies. The AI agent layer sits on top and never makes the
compliance decision itself.

## AI Agent Layer (`src/ai/`)

Four agents built on the hackathon's **Azure APIM endpoints**
(`apim-foundry-prod-ltts.azure-api.net`, OpenAI chat-completions wire format,
JSON-schema structured outputs with a prompt-enforced fallback):

| Agent | Model | Role | Boundary |
|---|---|---|---|
| **Intake Parser** | GPT-5.4 | Free-text device description → the 16 classification attributes (fills the form) | Parses only — the rules engine classifies |
| **OCR Intake** | GPT-5.4 Vision | Photo/scan of a datasheet, label, or IFU page → attributes | Reads only — the rules engine classifies |
| **Classification Auditor** | GPT-5.4 | Independent, adversarial second-opinion classification; flags disagreement + concerns | Advises only — disagreement is surfaced, not auto-applied |
| **Narrator** | GPT-5.2 | Turns each eliminated artifact into an auditor-ready, clause-cited justification | Explains only — buckets come from the filter engine |

**Key handling (per the hackathon security guidelines):** copy `.env.example` to
`.env`, paste the APIM subscription key, restart `npm run dev`. The browser only
ever calls relative `/llm/...` paths; the Vite dev-server proxy forwards them to
APIM and injects the `api-key` header server-side — the key never reaches the
browser bundle, localStorage, or the repo (`.env` is gitignored). This also
sidesteps CORS entirely.

**No API key? Everything still works.** Each agent has a deterministic mock
fallback, so the demo path is offline-safe. The AI Agents panel badge shows
Live vs Mock.

**Day-0 validation:** `node scripts/smoke-apim.mjs <key>` checks all three
deployments before you touch the UI.

## Demo devices (pre-verified — hour-12 gate)

| Device | Expected | Deciding rule |
|---|---|---|
| Stethoscope | Class I | Rule 1 |
| Reusable surgical scissors | Class I r | Rule 6 |
| Digital thermometer | Class IIa | Rule 10 |
| Hemodialysis machine | Class IIb | Rule 9 |
| AI sepsis-prediction software | Class III | Rule 11 |

> Decision support only. Final classification and documentation decisions remain with
> the manufacturer's regulatory affairs function and applicable regulatory bodies.
