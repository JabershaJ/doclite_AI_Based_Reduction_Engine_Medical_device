import type { Classification, DeviceProfile, EuClass, RuleHit } from './types'

const RANK: Record<EuClass, number> = { I: 0, IIa: 1, IIb: 2, III: 3 }

/**
 * Deterministic classifier implementing a demo-scoped subset of
 * EU MDR 2017/745 Annex VIII classification rules (per MDCG 2021-24).
 * Implementing rule 3.5: where several rules apply, the strictest
 * classification wins.
 */
export function classify(p: DeviceProfile): Classification {
  const hits: RuleHit[] = []
  const caveats: string[] = []

  const isInvasive = p.invasiveness !== 'none'
  const isSurgical = p.invasiveness === 'surgically-invasive'
  const isImplant = p.invasiveness === 'implantable'
  const hasSoftware = p.softwareImpact !== 'none'

  // ── Non-invasive devices: Rules 1–3 ──
  if (!isInvasive && !p.active) {
    if (p.modifiesBloodComposition) {
      hits.push({
        rule: 'Rule 3',
        title: 'Devices modifying the biological or chemical composition of blood / body liquids',
        outcome: 'IIb',
        rationale: 'The device modifies the biological/chemical composition of blood or liquids intended for infusion into the body.',
        triggeredBy: ['modifiesBloodComposition'],
      })
    } else if (p.channelsBlood) {
      hits.push({
        rule: 'Rule 2',
        title: 'Non-invasive devices channelling or storing blood / body liquids',
        outcome: 'IIa',
        rationale: 'The device channels or stores blood or body liquids for eventual administration into the body.',
        triggeredBy: ['channelsBlood'],
      })
    } else if (p.injuredSkinContact === 'none') {
      // Rule 4 covers injured-skin contact; Rule 1 is the default only when no other
      // non-invasive rule applies.
      hits.push({
        rule: 'Rule 1',
        title: 'Non-invasive devices (default)',
        outcome: 'I',
        rationale: 'Non-invasive device not covered by a stricter non-invasive rule.',
        triggeredBy: ['invasiveness = none'],
      })
    }
  }

  // ── Rule 4: non-invasive devices contacting injured skin / mucous membrane ──
  if (p.injuredSkinContact !== 'none') {
    const outcome: EuClass = p.injuredSkinContact === 'deep-wound' ? 'IIb' : p.injuredSkinContact === 'microenvironment' ? 'IIa' : 'I'
    hits.push({
      rule: 'Rule 4',
      title: 'Non-invasive devices in contact with injured skin or mucous membrane',
      outcome,
      rationale:
        p.injuredSkinContact === 'deep-wound'
          ? 'Intended principally for wounds which breach the dermis and can only heal by secondary intent → Class IIb.'
          : p.injuredSkinContact === 'microenvironment'
            ? 'Intended to manage the micro-environment of a wound (or mucous membrane) → Class IIa.'
            : 'Used as a mechanical barrier, for compression or absorption of exudates → Class I.',
      triggeredBy: [`injuredSkinContact = ${p.injuredSkinContact}`],
    })
  }

  // ── Invasive devices: Rules 5–8 ──
  if (p.invasiveness === 'body-orifice') {
    const outcome: EuClass = p.duration === 'transient' ? 'I' : p.duration === 'short-term' ? 'IIa' : 'IIb'
    hits.push({
      rule: 'Rule 5',
      title: 'Devices invasive with respect to body orifices',
      outcome,
      rationale: `Body-orifice invasive device for ${p.duration} use → Class ${outcome}.`,
      triggeredBy: ['invasiveness = body-orifice', `duration = ${p.duration}`],
    })
  }

  if (isSurgical && p.duration === 'transient') {
    if (p.contactCnsOrHeart) {
      hits.push({
        rule: 'Rule 6',
        title: 'Surgically invasive devices for transient use — heart/CNS contact',
        outcome: 'III',
        rationale: 'Transient surgically invasive device in direct contact with the heart, central circulatory system or CNS.',
        triggeredBy: ['surgically-invasive', 'transient', 'contactCnsOrHeart'],
      })
    } else if (p.reusableSurgical) {
      hits.push({
        rule: 'Rule 6',
        title: 'Reusable surgical instruments',
        outcome: 'I',
        rationale: 'Reusable surgical instrument (Class I r) — Notified Body involvement limited to reuse aspects.',
        triggeredBy: ['reusableSurgical'],
      })
    } else {
      hits.push({
        rule: 'Rule 6',
        title: 'Surgically invasive devices for transient use',
        outcome: 'IIa',
        rationale: 'Surgically invasive device intended for transient use.',
        triggeredBy: ['surgically-invasive', 'transient'],
      })
    }
  }

  if (isSurgical && p.duration === 'short-term') {
    const outcome: EuClass = p.contactCnsOrHeart ? 'III' : 'IIa'
    hits.push({
      rule: 'Rule 7',
      title: 'Surgically invasive devices for short-term use',
      outcome,
      rationale: p.contactCnsOrHeart
        ? 'Short-term surgically invasive device in direct contact with the heart/CNS → Class III.'
        : 'Surgically invasive device for short-term use.',
      triggeredBy: ['surgically-invasive', 'short-term', ...(p.contactCnsOrHeart ? ['contactCnsOrHeart'] : [])],
    })
  }

  if (isImplant || (isSurgical && p.duration === 'long-term')) {
    const outcome: EuClass = p.contactCnsOrHeart ? 'III' : 'IIb'
    hits.push({
      rule: 'Rule 8',
      title: 'Implantable and long-term surgically invasive devices',
      outcome,
      rationale: p.contactCnsOrHeart
        ? 'Implantable / long-term surgically invasive device with heart or CNS contact → Class III.'
        : 'Implantable or long-term surgically invasive device → Class IIb (default of Rule 8).',
      triggeredBy: [isImplant ? 'implantable' : 'surgically-invasive + long-term', ...(p.contactCnsOrHeart ? ['contactCnsOrHeart'] : [])],
    })
  }

  // ── Active devices: Rules 9–13 ──
  if (p.active && p.energy !== 'none') {
    const outcome: EuClass = p.energy === 'hazardous' ? 'IIb' : 'IIa'
    hits.push({
      rule: 'Rule 9',
      title: 'Active therapeutic devices administering or exchanging energy',
      outcome,
      rationale:
        p.energy === 'hazardous'
          ? 'Administers/exchanges energy in a potentially hazardous way → Class IIb.'
          : 'Administers or exchanges energy with the patient → Class IIa.',
      triggeredBy: ['active', `energy = ${p.energy}`],
    })
  }

  if (p.active && p.monitorsVitalParams) {
    const outcome: EuClass = p.vitalParamVariationDangerous ? 'IIb' : 'IIa'
    hits.push({
      rule: 'Rule 10',
      title: 'Active devices for diagnosis and monitoring',
      outcome,
      rationale: p.vitalParamVariationDangerous
        ? 'Monitors vital physiological parameters whose variation could result in immediate danger → Class IIb.'
        : 'Active device intended for diagnosis/monitoring of physiological parameters → Class IIa.',
      triggeredBy: ['active', 'monitorsVitalParams', ...(p.vitalParamVariationDangerous ? ['vitalParamVariationDangerous'] : [])],
    })
  }

  if (hasSoftware && p.softwareImpact !== 'other') {
    const outcome: EuClass =
      p.softwareImpact === 'critical-impact' ? 'III' : p.softwareImpact === 'serious-impact' ? 'IIb' : 'IIa'
    hits.push({
      rule: 'Rule 11',
      title: 'Software providing information for diagnostic or therapeutic decisions',
      outcome,
      rationale:
        p.softwareImpact === 'critical-impact'
          ? 'Decisions informed by the software may cause death or irreversible deterioration → Class III.'
          : p.softwareImpact === 'serious-impact'
            ? 'Decisions may cause serious deterioration or require surgical intervention → Class IIb.'
            : 'Software provides information used for diagnostic/therapeutic decisions → Class IIa.',
      triggeredBy: [`softwareImpact = ${p.softwareImpact}`],
    })
    caveats.push('Rule 11 (software) classifications are frequently borderline — confirm against MDCG 2019-11 with your regulatory expert.')
  } else if (hasSoftware && p.softwareImpact === 'other') {
    hits.push({
      rule: 'Rule 11',
      title: 'All other software',
      outcome: 'I',
      rationale: 'Software with no diagnostic/therapeutic decision impact → Class I.',
      triggeredBy: ['softwareImpact = other'],
    })
  }

  // Rule 12: active devices administering / removing medicinal products or body substances
  if (p.active && p.substanceAdministration !== 'none') {
    const outcome: EuClass = p.substanceAdministration === 'hazardous' ? 'IIb' : 'IIa'
    hits.push({
      rule: 'Rule 12',
      title: 'Active devices administering or removing medicinal products / body substances',
      outcome,
      rationale:
        p.substanceAdministration === 'hazardous'
          ? 'Administers or removes substances in a potentially hazardous manner (nature of substance, body part, or mode/rate of application) → Class IIb.'
          : 'Active device intended to administer and/or remove medicinal products or body substances → Class IIa.',
      triggeredBy: ['active', `substanceAdministration = ${p.substanceAdministration}`],
    })
  }

  if (p.active && hits.every((h) => !h.rule.startsWith('Rule 9') && !h.rule.startsWith('Rule 10') && !h.rule.startsWith('Rule 11') && !h.rule.startsWith('Rule 12'))) {
    hits.push({
      rule: 'Rule 13',
      title: 'All other active devices',
      outcome: 'I',
      rationale: 'Active device not covered by Rules 9–12.',
      triggeredBy: ['active'],
    })
  }

  // Rule 22: closed-loop systems / devices controlling-monitoring active implantables
  if (p.active && p.controlsActiveImplant) {
    hits.push({
      rule: 'Rule 22',
      title: 'Closed-loop systems and control/monitoring of active implantable devices',
      outcome: 'III',
      rationale:
        'Active device that controls, monitors or directly influences the performance of an active implantable device (e.g. pacemaker), or acts as a closed-loop system with an integrated diagnostic function significantly determining patient management → Class III (Rule 22; for software see MDCG 2019-11).',
      triggeredBy: ['active', 'controlsActiveImplant'],
    })
    caveats.push(
      'Rule 22 vs Rule 11 can be borderline for connectivity software: pure data relay for clinician review may fall under Rule 11 tiers instead — confirm the intended influence on the implant with your regulatory expert.'
    )
  }

  // ── Special rules ──
  if (p.medicinalSubstance) {
    hits.push({
      rule: 'Rule 14',
      title: 'Devices incorporating a medicinal substance',
      outcome: 'III',
      rationale: 'Incorporates, as an integral part, a substance which if used separately would be a medicinal product.',
      triggeredBy: ['medicinalSubstance'],
    })
  }

  if (hits.length === 0) {
    hits.push({
      rule: 'Rule 1',
      title: 'Non-invasive devices (default)',
      outcome: 'I',
      rationale: 'No stricter rule applies.',
      triggeredBy: [],
    })
  }

  // Strictest rule wins (Annex VIII, implementing rule 3.5)
  const deciding = hits.reduce((a, b) => (RANK[b.outcome] > RANK[a.outcome] ? b : a))
  const euClass = deciding.outcome

  // Several rules may independently yield the strictest class. All of them apply
  // (Annex VIII 3.5); state this rather than silently citing only the first hit.
  const coDeciding = hits.filter((h) => h.outcome === euClass && h !== deciding)
  if (coDeciding.length > 0) {
    caveats.push(
      `${[deciding, ...coDeciding].map((h) => h.rule).join(' and ')} independently yield Class ${euClass} — ` +
        `all apply under Annex VIII 3.5; the technical documentation should cite each applicable rule.`
    )
  }

  const specialLabels: string[] = []
  if (euClass === 'I' && p.sterile) specialLabels.push('Is (sterile)')
  if (euClass === 'I' && p.measuring) specialLabels.push('Im (measuring)')
  if (euClass === 'I' && p.reusableSurgical) specialLabels.push('Ir (reusable surgical)')

  const notifiedBodyRequired = euClass !== 'I' || specialLabels.length > 0

  const usClass: Classification['usClass'] = euClass === 'I' ? 'I' : euClass === 'III' ? 'III' : 'II'
  if (p.market !== 'EU') {
    caveats.push('US class shown is an indicative mapping — the authoritative FDA class comes from the product-code database (21 CFR 862–892), not from EU rules.')
  }

  return { euClass, usClass, specialLabels, notifiedBodyRequired, decidingRule: deciding, allHits: hits, caveats }
}
