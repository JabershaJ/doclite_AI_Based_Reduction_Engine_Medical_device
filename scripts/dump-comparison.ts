import { classify } from '../src/engine/classify'
import { buildChecklist } from '../src/engine/filter'
import { PRESETS } from '../src/data/presets'

// Dumps the submitted-vs-needed comparison data for the case-study artifact.
const preset = PRESETS.find((p) => p.label === 'Digital thermometer')!
const c = classify(preset.profile)
const cl = buildChecklist(preset.profile, c)

console.log(`DEVICE: ${preset.profile.name} — Class ${c.euClass} (${c.decidingRule.rule})`)
console.log(`Uniform baseline: ${cl.items.length} documents, ~${cl.hoursTotal} h`)
console.log(`Required: ${cl.required.length} (${cl.required.reduce((s, i) => s + i.artifact.effortHours, 0)} h)`)
console.log(`Conditional: ${cl.conditional.length} (${cl.conditional.reduce((s, i) => s + i.artifact.effortHours, 0)} h)`)
console.log(`Eliminated: ${cl.eliminated.length} (${cl.eliminated.reduce((s, i) => s + i.artifact.effortHours, 0)} h)`)
console.log(`Saved: ~${cl.hoursSaved} h (${cl.reductionPct}%)`)
console.log('\nELIMINATED (the excess a uniform submission carries):')
for (const i of cl.eliminated) {
  console.log(`  - ${i.artifact.name} | ${i.artifact.effortHours} h | ${i.artifact.mdrRef} | ${i.justification.slice(0, 110)}`)
}
console.log('\nCONDITIONAL:')
for (const i of cl.conditional) {
  console.log(`  - ${i.artifact.name} | ${i.artifact.effortHours} h`)
}
