import { classify } from '../src/engine/classify'
import { buildChecklist } from '../src/engine/filter'
import type { DeviceProfile } from '../src/engine/types'

// Ad-hoc harness: edit the profile below, run `npx tsx scripts/try-device.ts`
const profile: DeviceProfile = {
  name: 'Titanium Bone Fixation Screw',
  intendedUse: 'Sterile implantable screw for long-term fixation of bone fractures.',
  invasiveness: 'implantable',
  duration: 'long-term',
  active: false,
  softwareImpact: 'none',
  sterile: true,
  measuring: false,
  reusableSurgical: false,
  contactCnsOrHeart: false,
  channelsBlood: false,
  modifiesBloodComposition: false,
  medicinalSubstance: false,
  monitorsVitalParams: false,
  vitalParamVariationDangerous: false,
  energy: 'none',
  market: 'both',
}

const c = classify(profile)
const cl = buildChecklist(profile, c)
console.log(`${profile.name} → Class ${c.euClass} via ${c.decidingRule.rule} (${c.decidingRule.title})`)
console.log(`Rationale: ${c.decidingRule.rationale}`)
console.log(`Notified Body: ${c.notifiedBodyRequired}`)
console.log(`Checklist: ${cl.required.length} required / ${cl.conditional.length} conditional / ${cl.eliminated.length} eliminated | ~${cl.hoursSaved}h saved (${cl.reductionPct}%)`)
console.log(`Eliminated: ${cl.eliminated.map((i) => i.artifact.name).join(', ')}`)
