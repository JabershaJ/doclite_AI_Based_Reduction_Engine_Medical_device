// ─── Device intake model ────────────────────────────────────────────────────

export type Invasiveness = 'none' | 'body-orifice' | 'surgically-invasive' | 'implantable'
export type Duration = 'transient' | 'short-term' | 'long-term' // <60 min | ≤30 days | >30 days
export type SoftwareImpact =
  | 'none' // no software
  | 'other' // software with no diagnostic/therapeutic decision impact
  | 'inform-decisions' // provides info used for diagnostic/therapeutic decisions
  | 'serious-impact' // wrong decision → serious deterioration / surgical intervention
  | 'critical-impact' // wrong decision → death or irreversible deterioration
export type EnergyExchange = 'none' | 'low' | 'hazardous'
export type Market = 'EU' | 'US' | 'both'
export type InjuredSkinContact =
  | 'none' // no contact with injured skin or mucous membrane
  | 'barrier' // mechanical barrier / compression / absorption of exudates
  | 'microenvironment' // manages the micro-environment of a wound
  | 'deep-wound' // wounds breaching the dermis, healable only by secondary intent
export type SubstanceAdministration =
  | 'none' // does not administer or remove substances
  | 'standard' // administers/removes medicinal products or body substances
  | 'hazardous' // ...in a potentially hazardous manner (substance, body part, rate)

export interface DeviceProfile {
  name: string
  intendedUse: string
  invasiveness: Invasiveness
  duration: Duration
  active: boolean // has a power source
  softwareImpact: SoftwareImpact
  sterile: boolean // supplied sterile
  measuring: boolean // has a measuring function
  reusableSurgical: boolean
  contactCnsOrHeart: boolean // direct contact with heart, CNS or central circulatory system
  channelsBlood: boolean // channels/stores blood or liquids for eventual (re)administration
  modifiesBloodComposition: boolean // e.g. dialysers — modifies biological/chemical composition of blood
  medicinalSubstance: boolean // incorporates a medicinal substance with ancillary action
  monitorsVitalParams: boolean // monitors vital physiological parameters
  vitalParamVariationDangerous: boolean // ...where variation could result in immediate danger
  energy: EnergyExchange // administers/exchanges energy with the patient
  injuredSkinContact: InjuredSkinContact // Rule 4 — wound dressings etc.
  substanceAdministration: SubstanceAdministration // Rule 12 — infusion pumps etc.
  controlsActiveImplant: boolean // Rule 22 — controls/monitors/influences an active implantable (pacemaker etc.) or closed-loop therapy
  market: Market
}

// ─── Classification result ──────────────────────────────────────────────────

export type EuClass = 'I' | 'IIa' | 'IIb' | 'III'

export interface RuleHit {
  rule: string // e.g. "Rule 10"
  title: string
  outcome: EuClass
  rationale: string // why this rule fired for THIS device
  triggeredBy: string[] // device attributes that triggered the rule
}

export interface Classification {
  euClass: EuClass
  usClass: 'I' | 'II' | 'III'
  specialLabels: string[] // 'Is' sterile, 'Im' measuring, 'Ir' reusable surgical
  notifiedBodyRequired: boolean
  decidingRule: RuleHit
  allHits: RuleHit[]
  caveats: string[] // borderline warnings → "needs expert review"
}

// ─── Knowledge base / filtering ─────────────────────────────────────────────

export type Bucket = 'required' | 'conditional' | 'eliminated'

export interface Artifact {
  id: string
  name: string
  category: 'QMS Core' | 'Technical Documentation' | 'Clinical' | 'Post-Market' | 'Product Verification' | 'Software'
  isoClause: string // ISO 13485:2016 clause
  mdrRef: string // EU MDR article / annex
  qmsrRef: string // FDA QMSR (21 CFR 820, ISO 13485 incorporated by reference)
  effortHours: number // typical authoring + review effort (for the savings metric)
  evaluate: (p: DeviceProfile, c: Classification) => { bucket: Bucket; justification: string }
}

export interface ChecklistItem {
  artifact: Artifact
  bucket: Bucket
  justification: string
}

export interface ChecklistResult {
  items: ChecklistItem[]
  required: ChecklistItem[]
  conditional: ChecklistItem[]
  eliminated: ChecklistItem[]
  hoursSaved: number
  hoursTotal: number // uniform-rigor baseline
  reductionPct: number
}
