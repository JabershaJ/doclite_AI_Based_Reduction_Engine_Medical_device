import type { Classification, DeviceProfile } from '../engine/types'
import type { ChecklistItem } from '../engine/types'
import { isLive, structuredCall, visionCall } from './client'

/**
 * The agent layer, running on the hackathon's Azure APIM endpoints.
 * Four agents, each with a narrow role, all built on the same principle:
 * AI parses and explains — the deterministic rules engine decides.
 * Every agent has a mock fallback so the demo works with no API key.
 *
 *   1. Intake Parser  (GPT-5.4, vision) — free-text description and/or device image (PNG/JPEG,
 *                                         photo or datasheet/label scan) → structured profile attributes
 *   2. Auditor        (GPT-5.4)         — independent second-opinion classification; flags disagreement
 *   3. Narrator       (GPT-5.2)         — clause citations → auditor-ready narrative justification
 */

// ─── 1. Intake Parser Agent ─────────────────────────────────────────────────

export type ParsedIntake = Omit<DeviceProfile, 'name' | 'intendedUse'> & { deviceName: string }

const INTAKE_SCHEMA = {
  type: 'object',
  properties: {
    deviceName: { type: 'string' },
    invasiveness: { type: 'string', enum: ['none', 'body-orifice', 'surgically-invasive', 'implantable'] },
    duration: { type: 'string', enum: ['transient', 'short-term', 'long-term'] },
    active: { type: 'boolean' },
    softwareImpact: { type: 'string', enum: ['none', 'other', 'inform-decisions', 'serious-impact', 'critical-impact'] },
    sterile: { type: 'boolean' },
    measuring: { type: 'boolean' },
    reusableSurgical: { type: 'boolean' },
    contactCnsOrHeart: { type: 'boolean' },
    channelsBlood: { type: 'boolean' },
    modifiesBloodComposition: { type: 'boolean' },
    medicinalSubstance: { type: 'boolean' },
    monitorsVitalParams: { type: 'boolean' },
    vitalParamVariationDangerous: { type: 'boolean' },
    energy: { type: 'string', enum: ['none', 'low', 'hazardous'] },
    injuredSkinContact: { type: 'string', enum: ['none', 'barrier', 'microenvironment', 'deep-wound'] },
    substanceAdministration: { type: 'string', enum: ['none', 'standard', 'hazardous'] },
    controlsActiveImplant: { type: 'boolean' },
    market: { type: 'string', enum: ['EU', 'US', 'both'] },
  },
  required: [
    'deviceName', 'invasiveness', 'duration', 'active', 'softwareImpact', 'sterile', 'measuring',
    'reusableSurgical', 'contactCnsOrHeart', 'channelsBlood', 'modifiesBloodComposition',
    'medicinalSubstance', 'monitorsVitalParams', 'vitalParamVariationDangerous', 'energy',
    'injuredSkinContact', 'substanceAdministration', 'controlsActiveImplant', 'market',
  ],
  additionalProperties: false,
} as const

const INTAKE_SYSTEM = `You are a medical device regulatory intake specialist. Given a free-text device
description and/or an image of the device or its documentation, extract the device attributes used for
EU MDR 2017/745 Annex VIII classification.
Definitions:
- duration: transient <60 min continuous use, short-term <=30 days, long-term >30 days
- active: has an external power source (electrical or other)
- softwareImpact: 'none' if no software; 'other' if software has no diagnostic/therapeutic decision impact;
  'inform-decisions' if it provides information used for diagnosis or therapy decisions;
  'serious-impact' if a wrong decision could cause serious deterioration or surgical intervention;
  'critical-impact' if a wrong decision could cause death or irreversible deterioration
- energy: 'hazardous' if it administers or exchanges energy with the patient in a potentially hazardous way
- channelsBlood: channels or stores blood/body liquids for eventual (re)administration
- injuredSkinContact: for devices touching injured skin or mucous membrane — 'barrier' if a mechanical
  barrier / compression / exudate absorption only; 'microenvironment' if it manages the wound
  micro-environment (hydrogels, occlusive dressings); 'deep-wound' if principally for wounds breaching
  the dermis healable only by secondary intent (chronic ulcers, deep burns); else 'none'
- substanceAdministration: for ACTIVE devices administering or removing medicinal products or body
  substances — 'hazardous' if done in a potentially hazardous manner (rate-controlled delivery into
  the bloodstream such as infusion/insulin pumps, anaesthesia delivery); 'standard' for lower-risk
  administration (e.g. simple nebulizers); else 'none'
- controlsActiveImplant: true if the device (incl. software/connectivity) controls, monitors, programs
  or directly influences an active implantable device (pacemaker, ICD, neurostimulator, implanted pump)
  or is a closed-loop therapy system. Anything interacting with a pacemaker or similar implant should
  be true unless it clearly has no influence on the implant.
Default any attribute not implied by the description to the safest conservative reading, and default
market to 'both'. Extract only from what is stated or clearly implied — do not invent capabilities.`

const IMAGE_INSTRUCTION = `The image shows a medical device, or a device document — a datasheet, product
label, IFU page, or brochure. First read all visible text (OCR) and note what the device physically is,
then extract the device classification attributes, following the same definitions. Set deviceName from
the product name printed on the document, or from what the device visibly is.`

/**
 * Unified intake: free-text description, a device image (PNG/JPEG data URL), or both.
 * With both, the model combines the typed description with what it reads in the image;
 * the description wins where they conflict (the user knows their device).
 */
export async function runIntakeAgent(description: string, imageDataUrl?: string): Promise<ParsedIntake> {
  const text = description.trim()
  if (!isLive()) {
    const mocked = mockIntake(text || 'device from uploaded image')
    return imageDataUrl && !text ? { ...mocked, deviceName: 'Device from uploaded image (mock — set APIM_KEY for live OCR)' } : mocked
  }
  if (imageDataUrl) {
    const instruction = text
      ? `${IMAGE_INSTRUCTION}\n\nThe user also typed this description — combine it with the image; where they conflict, prefer the typed description:\n\n${text}`
      : IMAGE_INSTRUCTION
    return visionCall<ParsedIntake>(INTAKE_SYSTEM, instruction, imageDataUrl, INTAKE_SCHEMA)
  }
  return structuredCall<ParsedIntake>(INTAKE_SYSTEM, `Device description:\n\n${text}`, INTAKE_SCHEMA, { route: 'gpt54' })
}

// ─── 2. Auditor Agent (independent second opinion) ──────────────────────────

export interface AuditVerdict {
  agrees: boolean
  independentClass: 'I' | 'IIa' | 'IIb' | 'III'
  ruleCited: string
  reasoning: string
  concerns: string[]
}

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    agrees: { type: 'boolean' },
    independentClass: { type: 'string', enum: ['I', 'IIa', 'IIb', 'III'] },
    ruleCited: { type: 'string' },
    reasoning: { type: 'string' },
    concerns: { type: 'array', items: { type: 'string' } },
  },
  required: ['agrees', 'independentClass', 'ruleCited', 'reasoning', 'concerns'],
  additionalProperties: false,
} as const

const AUDIT_SYSTEM = `You are an independent regulatory affairs auditor with deep knowledge of EU MDR 2017/745
Annex VIII classification rules (Rules 1-22) and MDCG 2021-24 guidance. You will be shown a device profile and
a classification produced by a deterministic rules engine. Classify the device INDEPENDENTLY first, citing the
specific Annex VIII rule, then state whether you agree with the engine. List any concerns — borderline rules,
attributes that could plausibly be read differently, or rules the engine may have missed. Be adversarial:
your job is to catch mistakes, not to confirm.`

export async function runAuditorAgent(profile: DeviceProfile, c: Classification): Promise<AuditVerdict> {
  if (!isLive()) return mockAudit(c)
  const user = `Device profile:\n${JSON.stringify(profile, null, 2)}\n\nRules-engine classification: Class ${c.euClass} via ${c.decidingRule.rule} (${c.decidingRule.title}).\nRationale: ${c.decidingRule.rationale}`
  return structuredCall<AuditVerdict>(AUDIT_SYSTEM, user, AUDIT_SCHEMA, { route: 'gpt54' })
}

// ─── 3. Narrator Agent (auditor-ready justifications) ───────────────────────

const NARRATE_SCHEMA = {
  type: 'object',
  properties: {
    narratives: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          artifactId: { type: 'string' },
          narrative: { type: 'string' },
        },
        required: ['artifactId', 'narrative'],
        additionalProperties: false,
      },
    },
  },
  required: ['narratives'],
  additionalProperties: false,
} as const

const NARRATE_SYSTEM = `You are a regulatory documentation specialist. For each eliminated artifact you are
given, write a 2-3 sentence auditor-ready justification for why the document is NOT required for this specific
device — citing the regulation (EU MDR article/annex, ISO 13485 clause) and the device attribute that makes it
inapplicable. Write in the formal register of a technical file. Never overstate: if the elimination is
conditional, say so.`

export async function runNarratorAgent(
  profile: DeviceProfile,
  c: Classification,
  eliminated: ChecklistItem[]
): Promise<Record<string, string>> {
  if (!isLive()) {
    return Object.fromEntries(eliminated.map((i) => [i.artifact.id, `${i.justification} (Mock narrative — set APIM_KEY in .env for auditor-ready prose.)`]))
  }
  const user =
    `Device: ${profile.name} (Class ${c.euClass}, ${c.decidingRule.rule}). Intended use: ${profile.intendedUse}\n\n` +
    `Eliminated artifacts:\n` +
    eliminated.map((i) => `- id=${i.artifact.id} | ${i.artifact.name} | ${i.artifact.mdrRef} / ${i.artifact.isoClause} | engine justification: ${i.justification}`).join('\n')
  const result = await structuredCall<{ narratives: { artifactId: string; narrative: string }[] }>(
    NARRATE_SYSTEM, user, NARRATE_SCHEMA, { route: 'gpt52', maxTokens: 8192 }
  )
  return Object.fromEntries(result.narratives.map((n) => [n.artifactId, n.narrative]))
}

// ─── Mock fallbacks (no API key — demo-safe path) ───────────────────────────

function mockIntake(description: string): ParsedIntake {
  const d = description.toLowerCase()
  const software = /software|algorithm|\bai\b|app\b/.test(d)
  const active = software || /power|electric|battery|machine|pump|monitor/.test(d)
  const blood = /blood|dialys|infus/.test(d)
  return {
    deviceName: description.split(/[.,\n]/)[0].slice(0, 60) || 'Described device',
    invasiveness: /implant/.test(d) ? 'implantable' : /surg/.test(d) ? 'surgically-invasive' : /orifice|oral|rectal|nasal/.test(d) ? 'body-orifice' : 'none',
    duration: /long[- ]term|>\s*30|implant/.test(d) ? 'long-term' : /short[- ]term|day/.test(d) ? 'short-term' : 'transient',
    active,
    softwareImpact: software ? (/critical|death|sepsis|life/.test(d) ? 'critical-impact' : /serious|treat/.test(d) ? 'serious-impact' : 'inform-decisions') : 'none',
    sterile: /steril/.test(d),
    measuring: /measur|temperature|pressure/.test(d),
    reusableSurgical: /reusable/.test(d) && /surg/.test(d),
    contactCnsOrHeart: /heart|cns|central nervous|spinal/.test(d),
    channelsBlood: blood,
    modifiesBloodComposition: /dialyser|dialyzer|filter.*blood/.test(d),
    medicinalSubstance: /drug|medicinal|coated with/.test(d),
    monitorsVitalParams: /monitor|vital|heart rate|blood pressure|temperature/.test(d),
    vitalParamVariationDangerous: /icu|critical|dialys|life/.test(d),
    energy: /dialys|radiat|laser|defib/.test(d) ? 'hazardous' : active && !software ? 'low' : 'none',
    injuredSkinContact: /ulcer|chronic wound|deep wound|burn/.test(d)
      ? 'deep-wound'
      : /hydrogel|occlusive|wound dressing|wound care/.test(d)
        ? 'microenvironment'
        : /bandage|dressing|gauze|compress/.test(d)
          ? 'barrier'
          : 'none',
    substanceAdministration: /infusion|insulin pump|syringe pump|anaesthesia|anesthesia deliver/.test(d)
      ? 'hazardous'
      : /nebuliz|administer.*(drug|medicin)|drug deliver/.test(d)
        ? 'standard'
        : 'none',
    controlsActiveImplant: /pace ?maker|pacemaker|icd\b|defibrillator implant|neurostimulat|implanted pump|closed[- ]loop/.test(d),
    market: 'both',
  }
}

function mockAudit(c: Classification): AuditVerdict {
  return {
    agrees: true,
    independentClass: c.euClass,
    ruleCited: c.decidingRule.rule,
    reasoning:
      `(Mock verdict — set APIM_KEY in .env for a live independent audit.) Independent review reaches Class ${c.euClass} via ${c.decidingRule.rule}: ${c.decidingRule.rationale}`,
    concerns: c.caveats.length ? c.caveats : ['No live audit performed — running in offline mock mode.'],
  }
}
