import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { ParsedIntake } from './ai/agents'
import { AuditorCard, IntakeCard, LiveBadge, NarratorCard } from './components/AgentDock'
import { ANNEX_VIII_URL, isoUrl, mdrUrl, usUrl } from './components/lawLinks'
import { classify } from './engine/classify'
import { buildChecklist } from './engine/filter'
import type { Artifact, Bucket, ChecklistItem, DeviceProfile } from './engine/types'
import { BLANK_PROFILE, PRESETS } from './data/presets'

const BUCKET_META: Record<Bucket, { label: string; icon: string; cls: string }> = {
  required: { label: 'Required', icon: '●', cls: 'b-required' },
  conditional: { label: 'Conditional', icon: '◐', cls: 'b-conditional' },
  eliminated: { label: 'Eliminated', icon: '○', cls: 'b-eliminated' },
}

/** Fixed display order for artifact categories — mirrors a technical file's structure. */
const CATEGORY_ORDER: Artifact['category'][] = [
  'QMS Core',
  'Technical Documentation',
  'Product Verification',
  'Clinical',
  'Software',
  'Post-Market',
]

const CATEGORY_HINT: Record<Artifact['category'], string> = {
  'QMS Core': 'Quality-system procedures & records',
  'Technical Documentation': 'The technical file itself',
  'Product Verification': 'Testing & validation evidence',
  Clinical: 'Clinical evidence',
  Software: 'Software lifecycle & security',
  'Post-Market': 'Surveillance after placing on market',
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`toggle ${value ? 'on' : ''}`}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function CiteChip({ text, href, extraClass = '' }: { text: string; href: string | null; extraClass?: string }) {
  if (!href) return <span className={`chip ${extraClass}`}>{text}</span>
  return (
    <a className={`chip chip-link ${extraClass}`} href={href} target="_blank" rel="noreferrer" title="Open the official published text">
      {text} ↗
    </a>
  )
}

function ChecklistRow({ item, deviceClass, narrative }: { item: ChecklistItem; deviceClass: string; narrative?: string }) {
  const [open, setOpen] = useState(false)
  const m = BUCKET_META[item.bucket]
  const a = item.artifact
  return (
    <div className={`row ${m.cls}`}>
      <button className="row-head" onClick={() => setOpen(!open)}>
        <span className="row-icon">{m.icon}</span>
        <span className="row-name">{a.name}</span>
        <span className="row-hours">{a.effortHours} h</span>
        <span className="row-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="row-body">
          <p className="just">
            <strong>Why:</strong> {item.justification}
          </p>
          {narrative && (
            <p className="narrative-text">
              <strong>Auditor-ready narrative:</strong> {narrative}
            </p>
          )}
          <div className="trace">
            <span className="trace-label">Traceability</span>
            <div className="trace-chain">
              <span className="chip chip-class">Class {deviceClass}</span>
              <span className="arrow">→</span>
              <CiteChip text={a.mdrRef !== '—' && a.mdrRef !== 'n/a' ? a.mdrRef : 'no EU MDR ref'} href={mdrUrl(a.mdrRef)} />
              <span className="arrow">→</span>
              <CiteChip text={a.isoClause !== '—' ? a.isoClause : 'no ISO 13485 clause'} href={isoUrl(a.isoClause)} />
              <span className="arrow">→</span>
              <CiteChip text={a.qmsrRef} href={usUrl(a.qmsrRef)} extraClass="chip-us" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [profile, setProfile] = useState<DeviceProfile>(PRESETS[0].profile)
  const [activePreset, setActivePreset] = useState(0)
  const [activeBucket, setActiveBucket] = useState<Bucket>('required')
  const [narratives, setNarratives] = useState<Record<string, string> | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('doclite-theme') === 'dark' ? 'dark' : 'light'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('doclite-theme', theme)
  }, [theme])

  const set = <K extends keyof DeviceProfile>(k: K, v: DeviceProfile[K]) => {
    setProfile((p) => ({ ...p, [k]: v }))
    setActivePreset(-1)
    setNarratives(null)
  }

  const classification = useMemo(() => classify(profile), [profile])
  const checklist = useMemo(() => buildChecklist(profile, classification), [profile, classification])

  const applyIntake = (parsed: ParsedIntake, description: string) => {
    const { deviceName, ...attrs } = parsed
    setProfile({ ...attrs, name: deviceName, intendedUse: description })
    setActivePreset(-1)
    setNarratives(null)
  }

  const exportMarkdown = () => {
    const lines = [
      `# Documentation Checklist — ${profile.name || 'Unnamed device'}`,
      ``,
      `**EU Class:** ${classification.euClass} ${classification.specialLabels.join(', ')}  `,
      `**Deciding rule:** ${classification.decidingRule.rule} — ${classification.decidingRule.rationale}  `,
      `**Estimated effort saved vs uniform rigor:** ${checklist.hoursSaved} h (${checklist.reductionPct}%)`,
      ``,
      ...(['required', 'conditional', 'eliminated'] as Bucket[]).flatMap((b) => [
        `## ${BUCKET_META[b].label}`,
        ...checklist.items
          .filter((i) => i.bucket === b)
          .map((i) => `- **${i.artifact.name}** (${i.artifact.mdrRef} / ${i.artifact.isoClause}) — ${i.justification}`),
        ``,
      ]),
      `---`,
      `*Decision support only. Final classification and documentation decisions remain with the manufacturer's regulatory affairs function.*`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `checklist-${(profile.name || 'device').toLowerCase().replace(/\s+/g, '-')}.md`
    el.click()
    URL.revokeObjectURL(url)
  }

  const bucketItems = checklist.items.filter((i) => i.bucket === activeBucket)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand">
            Doc<b>Lite</b>
          </span>
          <span className="brand-sub">Risk-Based Documentation Reduction Engine</span>
        </div>
        <div className="topbar-actions">
          <LiveBadge />
          <button
            className="theme-toggle"
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className="btn btn-primary" onClick={exportMarkdown}>
            ⬇ Export .md
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="col-left">
          <IntakeCard onApplyIntake={applyIntake} />

          <section className="card">
            <div className="card-head">
              <h2>Device profile</h2>
              <span className="model-tag">19 attributes → engine input</span>
            </div>

            <div className="presets">
              {PRESETS.map((pr, i) => (
                <button
                  key={pr.label}
                  className={`preset ${i === activePreset ? 'active' : ''}`}
                  onClick={() => {
                    setProfile(pr.profile)
                    setActivePreset(i)
                    setNarratives(null)
                  }}
                >
                  {pr.label}
                  <span className="preset-exp">{pr.expected}</span>
                </button>
              ))}
              <button
                className={`preset ${activePreset === -2 ? 'active' : ''}`}
                onClick={() => {
                  setProfile(BLANK_PROFILE)
                  setActivePreset(-2)
                  setNarratives(null)
                }}
              >
                Custom device
                <span className="preset-exp">start blank</span>
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                Device name
                <input value={profile.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Digital thermometer" />
              </label>
              <label className="field">
                Intended use
                <input value={profile.intendedUse} onChange={(e) => set('intendedUse', e.target.value)} placeholder="What is the device intended to do, for whom?" />
              </label>
              <label className="field">
                Invasiveness
                <select value={profile.invasiveness} onChange={(e) => set('invasiveness', e.target.value as DeviceProfile['invasiveness'])}>
                  <option value="none">Non-invasive</option>
                  <option value="body-orifice">Invasive via body orifice</option>
                  <option value="surgically-invasive">Surgically invasive</option>
                  <option value="implantable">Implantable</option>
                </select>
              </label>
              <label className="field">
                Duration of use
                <select value={profile.duration} onChange={(e) => set('duration', e.target.value as DeviceProfile['duration'])}>
                  <option value="transient">Transient (&lt; 60 min)</option>
                  <option value="short-term">Short-term (≤ 30 days)</option>
                  <option value="long-term">Long-term (&gt; 30 days)</option>
                </select>
              </label>
              <label className="field">
                Software role
                <select value={profile.softwareImpact} onChange={(e) => set('softwareImpact', e.target.value as DeviceProfile['softwareImpact'])}>
                  <option value="none">No software</option>
                  <option value="other">Software, no decision impact</option>
                  <option value="inform-decisions">Informs diagnostic/therapeutic decisions</option>
                  <option value="serious-impact">Wrong decision → serious deterioration</option>
                  <option value="critical-impact">Wrong decision → death / irreversible</option>
                </select>
              </label>
              <label className="field">
                Energy to patient
                <select value={profile.energy} onChange={(e) => set('energy', e.target.value as DeviceProfile['energy'])}>
                  <option value="none">None</option>
                  <option value="low">Administers / exchanges energy</option>
                  <option value="hazardous">Potentially hazardous energy</option>
                </select>
              </label>
              <label className="field">
                Injured-skin / wound contact
                <select value={profile.injuredSkinContact} onChange={(e) => set('injuredSkinContact', e.target.value as DeviceProfile['injuredSkinContact'])}>
                  <option value="none">No contact with injured skin</option>
                  <option value="barrier">Barrier / compression / exudate absorption</option>
                  <option value="microenvironment">Manages wound micro-environment</option>
                  <option value="deep-wound">Deep wounds (heal by secondary intent)</option>
                </select>
              </label>
              <label className="field">
                Substance administration
                <select value={profile.substanceAdministration} onChange={(e) => set('substanceAdministration', e.target.value as DeviceProfile['substanceAdministration'])}>
                  <option value="none">Does not administer / remove substances</option>
                  <option value="standard">Administers / removes substances</option>
                  <option value="hazardous">…in a potentially hazardous manner</option>
                </select>
              </label>
              <label className="field">
                Target market
                <select value={profile.market} onChange={(e) => set('market', e.target.value as DeviceProfile['market'])}>
                  <option value="both">EU + US</option>
                  <option value="EU">EU only</option>
                  <option value="US">US only</option>
                </select>
              </label>
            </div>

            <div className="toggles">
              <Toggle label="Active (powered)" value={profile.active} onChange={(v) => set('active', v)} />
              <Toggle label="Supplied sterile" value={profile.sterile} onChange={(v) => set('sterile', v)} />
              <Toggle label="Measuring function" value={profile.measuring} onChange={(v) => set('measuring', v)} />
              <Toggle label="Reusable surgical instrument" value={profile.reusableSurgical} onChange={(v) => set('reusableSurgical', v)} />
              <Toggle label="Heart / CNS contact" value={profile.contactCnsOrHeart} onChange={(v) => set('contactCnsOrHeart', v)} />
              <Toggle label="Channels / stores blood" value={profile.channelsBlood} onChange={(v) => set('channelsBlood', v)} />
              <Toggle label="Modifies blood composition" value={profile.modifiesBloodComposition} onChange={(v) => set('modifiesBloodComposition', v)} />
              <Toggle label="Incorporates medicinal substance" value={profile.medicinalSubstance} onChange={(v) => set('medicinalSubstance', v)} />
              <Toggle label="Monitors vital parameters" value={profile.monitorsVitalParams} onChange={(v) => set('monitorsVitalParams', v)} />
              <Toggle label="…where variation is dangerous" value={profile.vitalParamVariationDangerous} onChange={(v) => set('vitalParamVariationDangerous', v)} />
              <Toggle label="Controls / monitors active implant" value={profile.controlsActiveImplant} onChange={(v) => set('controlsActiveImplant', v)} />
            </div>
          </section>
        </aside>

        <section className="col-main">
          <section className="card">
            <div className="card-head">
              <h2>Risk classification</h2>
              <a className="model-tag model-tag-link" href={ANNEX_VIII_URL} target="_blank" rel="noreferrer" title="Open Regulation (EU) 2017/745 on EUR-Lex — verify any rule against the official text">
                EU MDR 2017/745 · Annex VIII · deterministic ↗
              </a>
            </div>
            <div className="class-card">
              <div className={`class-badge cls-${classification.euClass}`}>
                <span className="class-label">EU MDR</span>
                <span className="class-value">Class {classification.euClass}</span>
                {classification.specialLabels.length > 0 && <span className="class-special">{classification.specialLabels.join(' · ')}</span>}
              </div>
              <div className="class-detail">
                <p className="deciding">
                  <strong>{classification.decidingRule.rule}</strong> — {classification.decidingRule.title}
                </p>
                <p>{classification.decidingRule.rationale}</p>
                <p className="meta">
                  Triggered by: {classification.decidingRule.triggeredBy.join(', ') || '—'} · Notified Body:{' '}
                  {classification.notifiedBodyRequired ? 'required' : 'not required (self-certification)'} · Indicative US class: {classification.usClass}
                </p>
                {classification.allHits.length > 1 && (
                  <details>
                    <summary>All {classification.allHits.length} rules evaluated (strictest wins — Annex VIII §3.5)</summary>
                    <ul>
                      {classification.allHits.map((h) => (
                        <li key={h.rule + h.outcome}>
                          <strong>{h.rule}</strong> → Class {h.outcome}: {h.rationale}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {classification.caveats.map((cv) => (
                  <p key={cv} className="caveat">
                    ⚠ {cv}
                  </p>
                ))}
              </div>
            </div>
            <AuditorCard profile={profile} classification={classification} />
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Minimal compliant documentation set</h2>
              <span className="model-tag">52 artifacts · every decision clause-cited</span>
            </div>

            <div className="savings">
              <div className="savings-bar">
                <div className="savings-fill" style={{ width: `${100 - checklist.reductionPct}%` }} />
              </div>
              <p>
                <strong>
                  {checklist.eliminated.length} of {checklist.items.length} artifacts eliminated
                </strong>
                , {checklist.conditional.length} right-sized —{' '}
                <strong>
                  ~{checklist.hoursSaved} h saved ({checklist.reductionPct}%)
                </strong>{' '}
                vs the uniform-rigor baseline of ~{checklist.hoursTotal} h.
              </p>
            </div>

            <div className="tabs" role="tablist">
              {(['required', 'conditional', 'eliminated'] as Bucket[]).map((b) => {
                const n = checklist.items.filter((i) => i.bucket === b).length
                return (
                  <button
                    key={b}
                    role="tab"
                    aria-selected={activeBucket === b}
                    className={`tab ${BUCKET_META[b].cls} ${activeBucket === b ? 'active' : ''}`}
                    onClick={() => setActiveBucket(b)}
                    title={b === 'eliminated' ? 'The Narrator agent (3 of 3) lives in this tab — auditor-ready prose per elimination' : undefined}
                  >
                    <span className="tab-icon">{BUCKET_META[b].icon}</span>
                    {BUCKET_META[b].label}
                    <span className="tab-count">{n}</span>
                    {b === 'eliminated' && <span className="tab-ai">✦ AI</span>}
                  </button>
                )
              })}
            </div>

            {activeBucket === 'eliminated' && checklist.eliminated.length > 0 && (
              <NarratorCard
                profile={profile}
                classification={classification}
                eliminated={checklist.eliminated}
                narratives={narratives}
                onNarratives={setNarratives}
              />
            )}

            <div className="rows">
              {bucketItems.length === 0 ? (
                <p className="empty">No artifacts in this bucket for the current device.</p>
              ) : (
                CATEGORY_ORDER.map((cat) => {
                  const items = bucketItems.filter((i) => i.artifact.category === cat)
                  if (items.length === 0) return null
                  const hours = items.reduce((sum, i) => sum + i.artifact.effortHours, 0)
                  return (
                    <div key={cat} className="cat-group">
                      <div className="cat-head">
                        <span className="cat-name">{cat}</span>
                        <span className="cat-hint">{CATEGORY_HINT[cat]}</span>
                        <span className="cat-meta">
                          {items.length} {items.length === 1 ? 'document' : 'documents'} · {hours} h
                        </span>
                      </div>
                      {items.map((i) => (
                        <ChecklistRow
                          key={i.artifact.id}
                          item={i}
                          deviceClass={classification.euClass}
                          narrative={activeBucket === 'eliminated' ? narratives?.[i.artifact.id] : undefined}
                        />
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </section>
      </main>

      <footer>
        Decision support only — final classification and documentation decisions remain with the manufacturer's regulatory affairs function and applicable
        regulatory bodies. Mappings: EU MDR 2017/745, ISO 13485:2016, FDA QMSR (21 CFR 820 incorporating ISO 13485 by reference, effective 2026-02-02).
      </footer>
    </div>
  )
}
