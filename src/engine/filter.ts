import { KNOWLEDGE_BASE } from './knowledgeBase'
import type { ChecklistItem, ChecklistResult, Classification, DeviceProfile } from './types'

/**
 * Filtering engine: runs every artifact's evaluate() against the device
 * profile + classification and computes the savings metric.
 *
 * Baseline for savings = "uniform rigor": the common industry practice of
 * producing every artifact for every device. Hours saved = full effort of
 * eliminated artifacts + half of conditional ones (right-sizing estimate).
 */
export function buildChecklist(p: DeviceProfile, c: Classification): ChecklistResult {
  const items: ChecklistItem[] = KNOWLEDGE_BASE.map((artifact) => {
    const { bucket, justification } = artifact.evaluate(p, c)
    return { artifact, bucket, justification }
  })

  const required = items.filter((i) => i.bucket === 'required')
  const conditional = items.filter((i) => i.bucket === 'conditional')
  const eliminated = items.filter((i) => i.bucket === 'eliminated')

  const hoursTotal = items.reduce((s, i) => s + i.artifact.effortHours, 0)
  const hoursSaved =
    eliminated.reduce((s, i) => s + i.artifact.effortHours, 0) +
    conditional.reduce((s, i) => s + i.artifact.effortHours / 2, 0)

  return {
    items,
    required,
    conditional,
    eliminated,
    hoursSaved: Math.round(hoursSaved),
    hoursTotal,
    reductionPct: Math.round((hoursSaved / hoursTotal) * 100),
  }
}
