# CLAUDE.md — DocLite Design Document


Project: **GOH-UC-019 — AI-Powered Risk-Based Documentation Reduction Engine for Medical Devices**
Event: LTTS Mega AI Hackathon 2026 (24-hour format, Azure platform, Bengaluru)
Stack: Vite + React 19 + TypeScript SPA · Azure APIM LLM endpoints · no backend, no database

This file is both the design document and the working guide for anyone (human or AI)
modifying this codebase. Read the Design Rules at the bottom before changing engine code.

---

## 1. Problem & Product

Medical device manufacturers apply uniform documentation rigor across all device classes,
producing excessive documentation for low-risk (Class I/IIa) devices. Regulations are
explicitly risk-based; companies lack a tool that *defensibly* maps device risk to a
minimal compliant documentation set.

**DocLite**: classify device risk (EU MDR 2017/745 Annex VIII) → generate the minimal
compliant documentation set → prove every decision (including every *elimination*) with
a clause citation.

Pitch inversion vs the market (FormlyAI/Dovetail, Celegence CAPTIS, Greenlight Guru):
competitors write your 200 documents faster; DocLite shows you only needed 80 of them,
with clause-cited proof for every one removed.

Regions: EU MDR primary (live rules engine) + FDA QMSR as a mapped column
(QMSR incorporates ISO 13485 by reference since 2026-02-02). Everything else
(IVDR, UKCA, CDSCO, PMDA, NMPA) is explicitly out of scope / roadmap.

---

## 2. Architecture

```
                    ┌────────────────────────────────────────────────┐
                    │                 React SPA (browser)            │
                    │                                                │
 free text ───────► │  AgentDock ──► ai/agents.ts ──► ai/client.ts ──┼──► /llm/* (relative)
 image (PNG/JPEG) ► │  (3 agents)     (mock fallbacks)   (fetch)     │         │
                    │        │ ParsedIntake                          │         ▼
                    │        ▼                                       │   Vite dev proxy
 form input ──────► │  DeviceProfile ──► engine/classify.ts          │   injects api-key
                    │                        │ Classification        │   from .env
                    │                        ▼                       │         │
                    │                  engine/filter.ts              │         ▼
                    │                  (× knowledgeBase.ts)          │   Azure APIM
                    │                        │ ChecklistResult       │   apim-foundry-prod-ltts
                    │                        ▼                       │   .azure-api.net
                    │   UI: class card · 3-bucket checklist ·        │   (GPT-5.4 / 5.2 / mini)
                    │   traceability chains · savings bar · export   │
                    └────────────────────────────────────────────────┘
```

**The load-bearing principle: AI parses and explains — the deterministic engine decides.**
No LLM output ever sets a device class or moves an artifact between buckets. This is the
defense against the "you can't let AI decide compliance" judge attack, and it makes every
output reproducible and auditable.

---

## 3. Module Design

### 3.1 `src/engine/` — deterministic core (no I/O, no async, fully testable)

| File | Responsibility |
|---|---|
| `types.ts` | Domain model. `DeviceProfile` (19 intake attributes), `Classification` (EU class + rule hits + caveats), `Artifact`, `ChecklistItem/Result`, `Bucket` = required/conditional/eliminated |
| `classify.ts` | EU MDR Annex VIII classifier. Evaluates every applicable rule → `RuleHit[]`, applies "strictest wins" (implementing rule 3.5), emits rule-tie caveats, derives Class I special labels (Is/Im/Ir), Notified Body flag, indicative US class, borderline caveats |
| `knowledgeBase.ts` | **The credibility core.** 52 artifacts (full-EU set), each mapped to ISO 13485:2016 clause + EU MDR annex/article + FDA QMSR ref + effort-hours, with an `evaluate(profile, classification)` returning a bucket **and a clause-cited justification — eliminations included** |
| `filter.ts` | Runs every artifact's `evaluate()`, groups buckets, computes savings vs the uniform-rigor baseline (eliminated hours + ½ conditional hours) |

**Classifier rule coverage:** Rules 1, 2, 3, 4 (injured-skin/wound contact), 5, 6 (incl.
reusable-surgical and heart/CNS exceptions), 7, 8, 9, 10, 11 (all three software tiers),
12 (active substance administration — infusion pumps), 13, 14, 22 (closed-loop / control-monitoring of active implantables — pacemaker software).
**NOT implemented:** Rules 15–21 (contraception, disinfection, imaging-recording, non-viable tissues, nanomaterials, inhaled/absorbed substances). Don't demo
devices that need those rules; adding one is ~10 lines in `classify.ts` + a regression entry.

**Knowledge-base nuances intentionally encoded** (these are pitch material):
- Class I → PMS report (Art. 85) replaces PSUR (Art. 86); PSUR cadence differs IIa vs IIb+
- US Class I design-control exemption (21 CFR 820.30(a)) — market-dependent elimination
- IFU omission possibility for Class I/IIa (Annex I §23.1(d)) → conditional, not required
- SSCP (Art. 32) and clinical investigation (Art. 61(4)) only for III/implantables, with the
  Art. 61(6) well-established-technologies hedge in the justification text
- IEC 62304/cybersecurity/60601/EMC eliminate cleanly when no software / not active
- Honest `conditional` bucket for genuinely contextual items (process validation, shelf life,
  usability, QMS software validation)

### 3.2 `src/ai/` — agent layer (Azure APIM)

| File | Responsibility |
|---|---|
| `client.ts` | Transport. Runtime live/mock status (`isLive()`, `refreshLiveStatus()`, `submitApimKey()` against the dev-server `/__apim-key` endpoint), model routes, `chat()` fetch to relative `/llm/...` with retry on 429/502/503/504 and network errors, `structuredCall<T>()` (json_schema `response_format`, falls back to prompt-enforced JSON on 400, strips markdown fences), `visionCall<T>()` for image inputs |
| `agents.ts` | The three agents: prompts, JSON schemas, mock fallbacks. All return typed objects |

**Agent roster and boundaries:**

| # | Agent | Model route | Input → Output | Boundary |
|---|---|---|---|---|
| 1 | Intake Parser | `gpt54` (text + vision) | free text and/or device image (PNG/JPEG data-URL — device photo, datasheet, label) → `ParsedIntake` (19 attributes + deviceName); typed text wins over the image on conflict | parses only |
| 2 | Classification Auditor | `gpt54` | profile + engine result → `AuditVerdict` (agrees, independentClass, ruleCited, reasoning, concerns) | advises only; adversarial by prompt |
| 3 | Narrator | `gpt52` | eliminated items → per-artifact auditor-ready narratives | explains only |

**Mock mode:** every agent checks `isLive()` and returns a deterministic offline fallback
(keyword-heuristic intake, agree-verdict audit, engine-justification narratives). The demo
path must never depend on network/key. Never remove this.

### 3.3 LLM infrastructure (hackathon-specific)

- Endpoints (from "5. APIM-Foundry-Hackathon-Endpoint-URL-Guide.xlsx"):
  - GPT-5.4 omni: `/gpt54/deployments/gpt-5.4/chat/completions?api-version=2024-12-01-preview` — reasoning, structured extraction, vision, OCR
  - GPT-5.2: `/gpt52/deployments/gpt-5.2/...` — report-quality prose
  - GPT-5 Mini: `/gpt5-mini/deployments/gpt-5-mini/...` — fast/cheap spare
  - Wire format: OpenAI chat completions; auth header `api-key`; use `max_completion_tokens`
- **Key handling:** `APIM_KEY` in `.env` (gitignored; `.env.example` documents it; no `VITE_`
  prefix so it is never bundled). `vite.config.ts` proxies `/llm/*` → APIM, injecting the
  header server-side, and defines `VITE_LLM_LIVE` from key presence. Solves CORS and the
  hackathon security guideline ("don't hardcode keys") in one mechanism.
  The key is also settable at runtime from the AgentDock UI: the dev server exposes
  `/__apim-key` (GET status; POST validates the key against APIM, holds it in the Node
  process, persists to `.env`). The key itself still never reaches the browser bundle.
- **Proxy resilience:** keep-alive HTTPS agent to APIM (fresh TCP connects intermittently
  time out on event networks) + client-side retry (3 attempts) on gateway errors. The
  proxy logs each LLM call (route, status, latency) to the dev-server terminal. Watcher
  ignores `*.zip/pptx/pdf/png` so exports in the project folder can't crash the server.
- Constraint: the proxy exists only under `npm run dev`. A hosted/built artifact needs an
  Express/FastAPI equivalent (~20 lines) — not yet written.

### 3.4 UI (`src/App.tsx`, `src/components/AgentDock.tsx`, `src/data/presets.ts`)

- `App.tsx`: app shell — sticky topbar (brand · LiveBadge · theme toggle · Export .md) over a
  two-column workspace. Left column: AI intake card + device profile card (preset chips +
  form + toggles). Right column: classification card (class badge, deciding rule, all-hits
  expander, caveats, inline AuditorCard, EUR-Lex link) + documentation panel (savings bar,
  bucket **tabs** Required/Conditional/Eliminated with counts, per-row traceability chains
  Class → MDR ref → ISO clause → QMSR ref with links to EUR-Lex/eCFR/ISO; NarratorCard sits
  in the Eliminated tab and its narratives render inside each row). Classification and
  checklist recompute live via `useMemo` on every profile change — no submit button.
  Light + dark themes (tokens in `index.css`, toggle persisted). Stacks below ~1020px.
- `AgentDock.tsx`: exports four contextual components — `LiveBadge` (topbar popover: live/mock
  status + runtime key add/validate/clear without restart), `IntakeCard` (free text, attached
  PNG/JPEG via picker or drag-and-drop with thumbnail chip, or both), `AuditorCard` (adversarial
  second opinion, marks itself stale when the profile changes), `NarratorCard`. Intake results
  funnel through `onApplyIntake` → `setProfile` — the same path as manual form entry (agents
  get no privileged write access).
- `components/lawLinks.ts`: maps citation strings to official sources (EUR-Lex consolidated
  MDR with `#art_N` anchors, eCFR part-level URLs, ISO catalogue). Only links verified-reachable
  URL patterns; refs with no public source stay plain text.
- `presets.ts`: 5 pre-verified demo devices spanning I → III (stethoscope, reusable surgical
  scissors Ir, digital thermometer IIa, hemodialysis machine IIb, AI sepsis SaMD III).
  **Only demo devices that have been verified.**

---

## 4. Data Flow (canonical path)

1. Attributes enter as a `DeviceProfile` — typed manually, or via the Intake agent
   (text and/or image → `ParsedIntake` → same setter).
2. `classify(profile)` evaluates all applicable Annex VIII rules; strictest hit wins; caveats
   collected (e.g. Rule 11 borderline warning, rule ties, indicative-US-class disclaimer).
3. `buildChecklist(profile, classification)` maps all 52 artifacts → bucket + justification;
   computes hours saved and reduction % vs uniform rigor.
4. UI renders; optional agent passes (Auditor second opinion, Narrator prose) attach to the
   result but never mutate it.
5. Export serializes the checklist + citations + disclaimer to Markdown.

---

## 5. Design Decisions & Rationale

| Decision | Rationale |
|---|---|
| Hybrid rules+LLM, never pure LLM | Regulatory defensibility; reproducible outputs; survives the obvious judge attack |
| All client-side, no backend/DB | 24-hour scope; demo cannot fail on missing infra; KB fits in code |
| Mock mode everywhere | Key arrives only on hackathon day; offline demo safety |
| Vite proxy for key + CORS | Key never in browser; complies with event security guidelines; zero extra processes |
| Schema-constrained agent outputs | No fragile text parsing when judges type unexpected input |
| Eliminations carry citations | "Eliminated with proof" IS the product differentiator |
| Effort-hours per artifact | Enables the savings metric (64% Class I → 15% Class III gradient = "rigor scales with risk") |
| 52 artifacts, not 200 | Full-EU set; citation quality over coverage — every entry human-verified against the regulation |
| `strictest wins` explicit in UI | Annex VIII 3.5 compliance; the all-hits expander shows the engine isn't a black box |

---

## 6. Testing & Verification

| Layer | How | Command |
|---|---|---|
| Classifier regression | Pre-verified devices + rule-tie + Rule 4/12 cases, expected class asserted | `npx tsx scripts/verify.ts` |
| Ad-hoc device probe | Edit profile object, inspect full result | `npx tsx scripts/try-device.ts` |
| Types + bundle | tsc + vite | `npm run build` |
| APIM endpoints (day-0) | 3 deployments, 1 cheap call each | `node scripts/smoke-apim.mjs <key>` |
| Manual UI walkthrough | Presets → custom device → buckets → traceability → export → agents | `npm run dev` → http://localhost:5173 |

**Gate discipline:** classifier must pass `verify.ts` before anything else matters. When a
new device is verified correct, promote it: profile → `presets.ts`, expected class → `verify.ts`.

---

## 7. Known Limitations (state openly — they strengthen the pitch)

1. Decision support only — RA professional signs off; disclaimer rendered in UI + export.
2. Rule coverage is a demo subset (Rules 15–21 not implemented).
3. KB is a snapshot; MDCG guidance evolves; no curation pipeline.
4. "Eliminated" = regulatory minimum; Notified Bodies/customers may still demand documents.
5. US class is an indicative mapping, not a product-code determination.
6. Dev-server-only proxy (see 3.3).
7. The tool itself would need QMS software validation (ISO 13485 §4.1.6) if adopted for real.

---

## 8. Commands

```bash
npm run dev                        # dev server + LLM proxy → http://localhost:5173
npm run build                      # tsc + vite production build
npx tsx scripts/verify.ts          # classifier regression (run after ANY engine change)
npx tsx scripts/try-device.ts      # ad-hoc device classification probe
node scripts/smoke-apim.mjs <key>  # day-0 APIM validation
```

Hackathon-day switch-on: `copy .env.example .env` → paste key → restart `npm run dev` →
badge flips to Live. (Or paste the key into the AgentDock UI at runtime — no restart.)

---

## 9. Design Rules for Future Changes

1. **Never let an agent write a classification or bucket.** Agents produce `ParsedIntake`,
   verdicts, or prose — the engine owns decisions. If a feature needs the LLM to "correct"
   the engine, surface it as a flagged disagreement instead.
2. **Every artifact evaluation must cite a clause** — in all three buckets. An elimination
   without a citation is a regression of the core product idea.
3. **Engine changes require `verify.ts` green** and, for new rules/artifacts, a new assertion.
4. **Keep mock fallbacks in lockstep** with any agent schema change.
5. **Never move `APIM_KEY` into client-visible code** (no `VITE_` prefix, no literals).
6. **Don't add heavy deps** — the app must stay instantly buildable on a hackathon VM.
7. Classifier rationale strings are user-facing regulatory text: keep the register formal,
   cite rules the way MDCG 2021-24 does, and hedge borderline cases honestly
   ("needs expert review" beats a confident wrong answer).
