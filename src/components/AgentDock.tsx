import { useEffect, useRef, useState } from 'react'
import type { AuditVerdict, ParsedIntake } from '../ai/agents'
import { runAuditorAgent, runIntakeAgent, runNarratorAgent } from '../ai/agents'
import { isLive, refreshLiveStatus, submitApimKey } from '../ai/client'
import type { ChecklistItem, Classification, DeviceProfile } from '../engine/types'

/**
 * The agent surface, decomposed into contextual cards:
 *   LiveBadge   — topbar: live/mock status + runtime key management
 *   IntakeCard  — left column: text and/or image → ParsedIntake → form
 *   AuditorCard — classification panel: adversarial second opinion
 *   NarratorCard— eliminated tab: auditor-ready narratives per elimination
 * Boundary unchanged: agents parse and explain — the engine decides.
 */

// ─── Live/Mock badge + runtime key management (topbar) ──────────────────────

export function LiveBadge() {
  const [live, setLive] = useState(isLive())
  const [open, setOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    refreshLiveStatus().then(setLive)
  }, [])

  const activate = async () => {
    if (busy || !keyInput.trim()) return
    setBusy(true)
    setError('')
    try {
      const err = await submitApimKey(keyInput.trim())
      if (err) {
        setError(err)
      } else {
        setKeyInput('')
        setOpen(false)
        setLive(true)
      }
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async () => {
    if (busy) return
    setBusy(true)
    try {
      await submitApimKey('')
      setLive(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="live-wrap">
      <button className={`badge ${live ? 'badge-live' : 'badge-mock'}`} onClick={() => setOpen(!open)} title="Manage API key">
        {live ? '● Live — Azure APIM' : '○ Mock mode'}
        <span className="badge-chev">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="live-pop">
          {live ? (
            <>
              <p>Key active for this session. Agents call GPT-5.4 / 5.2 through the server-side proxy — the key never reaches the browser.</p>
              <button className="btn" disabled={busy} onClick={deactivate}>
                {busy ? 'Switching…' : 'Switch to mock mode'}
              </button>
            </>
          ) : (
            <>
              <p>Agents run offline fallbacks. Paste the APIM subscription key to go live — it is validated first and stored server-side only.</p>
              <div className="live-pop-form">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && activate()}
                  placeholder="APIM subscription key…"
                />
                <button className="btn btn-primary" disabled={busy || !keyInput.trim()} onClick={activate}>
                  {busy ? 'Validating…' : 'Activate'}
                </button>
              </div>
              {error && <p className="inline-error">⚠ {error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Intake card (left column) ───────────────────────────────────────────────

interface AttachedImage {
  dataUrl: string
  name: string
}

export function IntakeCard({ onApplyIntake }: { onApplyIntake: (parsed: ParsedIntake, description: string) => void }) {
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<AttachedImage | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const attachImage = (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError('Please attach a PNG, JPEG, or WebP image.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => setImage({ dataUrl: reader.result as string, name: file.name })
    reader.onerror = () => setError('Could not read the image file.')
    reader.readAsDataURL(file)
  }

  const parse = async () => {
    setBusy(true)
    setError('')
    try {
      const parsed = await runIntakeAgent(description, image?.dataUrl)
      const source = description.trim() || (image ? `Extracted from uploaded image: ${image.name}` : '')
      onApplyIntake(parsed, source)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`card intake ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) attachImage(f)
      }}
    >
      <div className="card-head">
        <h2>AI intake</h2>
        <span className="model-tag">Agent 1 of 3 · GPT-5.4 · text + vision</span>
      </div>
      <p className="card-note">Describe the device, attach a photo / datasheet / label image, or both — the agent fills the profile below. The rules engine makes every decision.</p>
      <textarea
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. A powered bedside machine that pumps a patient's blood through a dialyser to remove waste products, monitoring pressure and temperature continuously…"
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) attachImage(f)
          e.target.value = ''
        }}
      />
      {image ? (
        <div className="intake-attachment">
          <img src={image.dataUrl} alt={image.name} />
          <span className="intake-attachment-name">{image.name}</span>
          <button className="btn btn-ghost" disabled={busy} onClick={() => setImage(null)} title="Remove image">
            ✕
          </button>
        </div>
      ) : (
        <p className="intake-drop-hint">Drag &amp; drop an image here, or attach one below.</p>
      )}
      <div className="card-actions">
        {!image && (
          <button className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>
            Attach image…
          </button>
        )}
        <button className="btn btn-primary" disabled={busy || (!description.trim() && !image)} onClick={parse}>
          {busy ? 'Parsing…' : description.trim() && image ? 'Parse text + image' : image ? 'Read image' : 'Parse description'}
        </button>
      </div>
      {error && <p className="inline-error">⚠ {error}</p>}
    </div>
  )
}

// ─── Auditor card (classification panel) ─────────────────────────────────────

export function AuditorCard({ profile, classification }: { profile: DeviceProfile; classification: Classification }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [verdict, setVerdict] = useState<AuditVerdict | null>(null)
  const [forClass, setForClass] = useState('')

  const audit = async () => {
    setBusy(true)
    setError('')
    try {
      setVerdict(await runAuditorAgent(profile, classification))
      setForClass(classification.euClass)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const stale = verdict !== null && forClass !== classification.euClass

  return (
    <div className="auditor">
      <div className="auditor-head">
        <button className="btn" disabled={busy} onClick={audit}>
          {busy ? 'Auditing…' : verdict ? 'Re-run adversarial audit' : 'Run adversarial audit'}
        </button>
        <span className="model-tag">Agent 2 of 3 · GPT-5.4 · independent second opinion — flags disagreement, never overrides</span>
      </div>
      {stale && <p className="inline-warn">Profile changed since this audit — re-run for a current opinion.</p>}
      {verdict && (
        <div className={`verdict ${verdict.agrees ? 'verdict-ok' : 'verdict-warn'}`}>
          <strong>
            {verdict.agrees ? '✔ Auditor agrees' : '✘ Auditor disagrees'} — independent result: Class {verdict.independentClass} ({verdict.ruleCited})
          </strong>
          <p>{verdict.reasoning}</p>
          {verdict.concerns.length > 0 && (
            <ul>
              {verdict.concerns.map((cn) => (
                <li key={cn}>{cn}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="inline-error">⚠ {error}</p>}
    </div>
  )
}

// ─── Narrator card (eliminated tab) ──────────────────────────────────────────

export function NarratorCard({
  profile,
  classification,
  eliminated,
  narratives,
  onNarratives,
}: {
  profile: DeviceProfile
  classification: Classification
  eliminated: ChecklistItem[]
  narratives: Record<string, string> | null
  onNarratives: (n: Record<string, string> | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const narrate = async () => {
    setBusy(true)
    setError('')
    try {
      onNarratives(await runNarratorAgent(profile, classification, eliminated))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="narrator">
      <button className="btn" disabled={busy || eliminated.length === 0} onClick={narrate}>
        {busy ? 'Writing…' : narratives ? 'Regenerate narratives' : `Generate auditor-ready narratives (${eliminated.length})`}
      </button>
      <span className="model-tag">Agent 3 of 3 · GPT-5.2 · formal technical-file prose per elimination — appears inside each row below</span>
      {error && <p className="inline-error">⚠ {error}</p>}
    </div>
  )
}
