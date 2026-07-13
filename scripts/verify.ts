import { classify } from '../src/engine/classify'
import { buildChecklist } from '../src/engine/filter'
import { PRESETS } from '../src/data/presets'

const EXPECTED: Record<string, string> = {
  Stethoscope: 'I',
  'Reusable surgical scissors': 'I',
  'Digital thermometer': 'IIa',
  'Hemodialysis machine': 'IIb',
  'AI sepsis-prediction software': 'III',
}

let failures = 0
for (const p of PRESETS) {
  const c = classify(p.profile)
  const cl = buildChecklist(p.profile, c)
  const ok = c.euClass === EXPECTED[p.label]
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${p.label.padEnd(30)} → Class ${c.euClass.padEnd(4)} (${c.decidingRule.rule}, expected ${EXPECTED[p.label]})` +
      `  | req ${cl.required.length} / cond ${cl.conditional.length} / elim ${cl.eliminated.length} | saved ~${cl.hoursSaved}h (${cl.reductionPct}%)`
  )
  if (c.specialLabels.length) console.log(`      special: ${c.specialLabels.join(', ')}`)
}
// Rule-tie regression: when several rules independently yield the strictest class,
// the class is stable and a caveat names every co-deciding rule (Annex VIII 3.5).
// Real case: ICU monitor parsed with body-orifice probes — Rule 5 and Rule 10 both → IIb.
{
  const tieProfile = {
    name: 'ICU multi-parameter monitor (rule-tie case)',
    intendedUse: 'Continuous ECG/SpO2/invasive BP monitoring in intensive care.',
    invasiveness: 'body-orifice',
    duration: 'long-term',
    active: true,
    softwareImpact: 'inform-decisions',
    sterile: false,
    measuring: true,
    reusableSurgical: false,
    contactCnsOrHeart: false,
    channelsBlood: false,
    modifiesBloodComposition: false,
    medicinalSubstance: false,
    monitorsVitalParams: true,
    vitalParamVariationDangerous: true,
    energy: 'low',
    injuredSkinContact: 'none',
    substanceAdministration: 'none',
    controlsActiveImplant: false,
    market: 'both',
  } as const
  const c = classify(tieProfile)
  const tieCaveat = c.caveats.find((cv) => cv.includes('independently yield'))
  const ok = c.euClass === 'IIb' && tieCaveat !== undefined && tieCaveat.includes('Rule 5') && tieCaveat.includes('Rule 10')
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${'Rule-tie: ICU monitor'.padEnd(30)} → Class ${c.euClass.padEnd(4)} (${c.decidingRule.rule}, expected IIb + tie caveat)`
  )
  if (tieCaveat) console.log(`      caveat: ${tieCaveat}`)
}

// Rule 12 regression: volumetric infusion pump — rate-controlled IV delivery → IIb.
// Rule 4 regression: hydrocolloid dressing for chronic ulcers (deep wound) → IIb.
{
  const base = {
    duration: 'transient', softwareImpact: 'none', sterile: false, measuring: false,
    reusableSurgical: false, contactCnsOrHeart: false, channelsBlood: false,
    modifiesBloodComposition: false, medicinalSubstance: false, monitorsVitalParams: false,
    vitalParamVariationDangerous: false, controlsActiveImplant: false, market: 'both',
  } as const

  const pump = classify({
    ...base,
    name: 'Volumetric Infusion Pump',
    intendedUse: 'Rate-controlled intravenous administration of medicinal products.',
    invasiveness: 'none', active: true, energy: 'low',
    injuredSkinContact: 'none', substanceAdministration: 'hazardous',
  })
  const pumpOk = pump.euClass === 'IIb' && pump.allHits.some((h) => h.rule === 'Rule 12')
  if (!pumpOk) failures++
  console.log(`${pumpOk ? 'PASS' : 'FAIL'}  ${'Infusion pump (Rule 12)'.padEnd(30)} → Class ${pump.euClass.padEnd(4)} (${pump.decidingRule.rule}, expected IIb via Rule 12)`)

  const dressing = classify({
    ...base,
    name: 'Hydrocolloid Wound Dressing',
    intendedUse: 'Management of chronic ulcers healing by secondary intent.',
    invasiveness: 'none', active: false, energy: 'none',
    injuredSkinContact: 'deep-wound', substanceAdministration: 'none',
  })
  const dressingOk = dressing.euClass === 'IIb' && dressing.decidingRule.rule === 'Rule 4'
  if (!dressingOk) failures++
  console.log(`${dressingOk ? 'PASS' : 'FAIL'}  ${'Chronic-wound dressing (Rule 4)'.padEnd(30)} → Class ${dressing.euClass.padEnd(4)} (${dressing.decidingRule.rule}, expected IIb via Rule 4)`)

  // Rule 22 regression: pacemaker telemetry/programming software → III.
  const pacemakerSw = classify({
    ...base,
    name: 'Pacemaker Telemetry & Programming Software',
    intendedUse: 'Monitors and configures an implanted cardiac pacemaker remotely.',
    invasiveness: 'none', active: true, energy: 'none',
    softwareImpact: 'inform-decisions',
    injuredSkinContact: 'none', substanceAdministration: 'none',
    controlsActiveImplant: true,
  })
  const pmOk = pacemakerSw.euClass === 'III' && pacemakerSw.decidingRule.rule === 'Rule 22'
  if (!pmOk) failures++
  console.log(`${pmOk ? 'PASS' : 'FAIL'}  ${'Pacemaker software (Rule 22)'.padEnd(30)} → Class ${pacemakerSw.euClass.padEnd(4)} (${pacemakerSw.decidingRule.rule}, expected III via Rule 22)`)
}

console.log(failures === 0 ? '\nAll demo devices classify as expected.' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
