import type { Artifact, Bucket, DeviceProfile } from './types'

const req = (justification: string) => ({ bucket: 'required' as Bucket, justification })
const cond = (justification: string) => ({ bucket: 'conditional' as Bucket, justification })
const elim = (justification: string) => ({ bucket: 'eliminated' as Bucket, justification })

const hasSoftware = (p: DeviceProfile) => p.softwareImpact !== 'none'
const hasBodyContact = (p: DeviceProfile) => p.invasiveness !== 'none' || p.channelsBlood || p.modifiesBloodComposition

/**
 * Curated regulatory knowledge base — 32 artifacts mapped to
 * ISO 13485:2016, EU MDR 2017/745 and FDA QMSR (21 CFR 820, which since
 * 2026-02-02 incorporates ISO 13485:2016 by reference).
 *
 * Every evaluate() returns a bucket AND a clause-cited justification —
 * including for eliminations. That justification IS the product.
 */
export const KNOWLEDGE_BASE: Artifact[] = [
  // ── QMS Core (largely class-independent — honesty matters here) ──
  {
    id: 'quality-manual',
    name: 'Quality Manual',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §4.2.2',
    mdrRef: 'MDR Art. 10(9)',
    qmsrRef: 'QMSR §820.10 → ISO 13485 §4.2.2',
    effortHours: 40,
    evaluate: () => req('A quality manual is mandatory for every manufacturer regardless of device class (ISO 13485 §4.2.2).'),
  },
  {
    id: 'doc-control',
    name: 'Document Control Procedure',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §4.2.4',
    mdrRef: 'MDR Art. 10(9)(g)',
    qmsrRef: 'QMSR → ISO 13485 §4.2.4',
    effortHours: 16,
    evaluate: () => req('Control of documents is a mandatory QMS procedure for all classes (ISO 13485 §4.2.4).'),
  },
  {
    id: 'records-control',
    name: 'Records Control Procedure',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §4.2.5',
    mdrRef: 'MDR Art. 10(8)',
    qmsrRef: 'QMSR → ISO 13485 §4.2.5',
    effortHours: 12,
    evaluate: () => req('Control of records is mandatory for all classes (ISO 13485 §4.2.5); MDR requires retention ≥10 years (15 for implantables).'),
  },
  {
    id: 'management-review',
    name: 'Management Review Records',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §5.6',
    mdrRef: 'MDR Art. 10(9)',
    qmsrRef: 'QMSR §820.20 → ISO 13485 §5.6',
    effortHours: 8,
    evaluate: () => req('Management review at planned intervals is mandatory for all classes (ISO 13485 §5.6).'),
  },
  {
    id: 'internal-audit',
    name: 'Internal Audit Program & Records',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §8.2.4',
    mdrRef: 'MDR Art. 10(9)',
    qmsrRef: 'QMSR → ISO 13485 §8.2.4',
    effortHours: 24,
    evaluate: () => req('Internal audits at planned intervals are mandatory for all classes (ISO 13485 §8.2.4).'),
  },
  {
    id: 'capa',
    name: 'CAPA Procedure & Records',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §8.5.2 / §8.5.3',
    mdrRef: 'MDR Art. 10(9)(l)',
    qmsrRef: 'QMSR → ISO 13485 §8.5',
    effortHours: 20,
    evaluate: () => req('Corrective and preventive action procedures are mandatory for all classes (ISO 13485 §8.5.2–8.5.3).'),
  },
  {
    id: 'training',
    name: 'Competence & Training Records',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §6.2',
    mdrRef: 'MDR Art. 10(9)',
    qmsrRef: 'QMSR → ISO 13485 §6.2',
    effortHours: 8,
    evaluate: () => req('Competence, training and awareness records are mandatory for all classes (ISO 13485 §6.2).'),
  },
  {
    id: 'supplier-controls',
    name: 'Supplier Evaluation & Purchasing Controls',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §7.4',
    mdrRef: 'MDR Art. 10(9)(d)',
    qmsrRef: 'QMSR §820.50 → ISO 13485 §7.4',
    effortHours: 16,
    evaluate: () => req('Purchasing and supplier controls are mandatory for all classes (ISO 13485 §7.4); rigor scales with supplied-product risk.'),
  },

  // ── Technical Documentation ──
  {
    id: 'tech-file',
    name: 'Technical Documentation File (structure per Annex II/III)',
    category: 'Technical Documentation',
    isoClause: 'ISO 13485 §4.2.3 (medical device file)',
    mdrRef: 'MDR Annex II & III',
    qmsrRef: 'QMSR → ISO 13485 §4.2.3',
    effortHours: 60,
    evaluate: (_p, c) =>
      req(`Technical documentation per Annex II/III is required for ALL classes including Class ${c.euClass} — but its depth scales with class.`),
  },
  {
    id: 'gspr-checklist',
    name: 'GSPR Conformity Checklist',
    category: 'Technical Documentation',
    isoClause: 'ISO 13485 §7.2.1 (regulatory requirements)',
    mdrRef: 'MDR Annex I + Annex II §4',
    qmsrRef: 'n/a (EU-specific; US analogue: recognized consensus standards)',
    effortHours: 24,
    evaluate: () => req('Demonstration of conformity with the General Safety and Performance Requirements (Annex I) is required for every device placed on the EU market.'),
  },
  {
    id: 'risk-mgmt-file',
    name: 'Risk Management File (ISO 14971)',
    category: 'Technical Documentation',
    isoClause: 'ISO 13485 §7.1',
    mdrRef: 'MDR Annex I §3 + Annex II §5',
    qmsrRef: 'QMSR → ISO 13485 §7.1',
    effortHours: 50,
    evaluate: (_p, c) =>
      req(`Risk management per ISO 14971 is required for all classes — Annex I §3 admits no class-based exemption. Depth is proportionate to Class ${c.euClass} risk.`),
  },
  {
    id: 'design-dev-file',
    name: 'Design & Development File (design controls)',
    category: 'Technical Documentation',
    isoClause: 'ISO 13485 §7.3',
    mdrRef: 'MDR Annex II §1–3, 6',
    qmsrRef: 'QSR/QMSR: most US Class I devices are EXEMPT from design controls (21 CFR 820.30(a))',
    effortHours: 80,
    evaluate: (p, c) => {
      if (c.euClass === 'I' && p.market === 'US')
        return elim('US Class I devices are exempt from design controls unless listed in 21 CFR 820.30(a)(2) — full design history file eliminated for this market.')
      if (c.euClass === 'I')
        return cond('EU: design/development documentation still needed under ISO 13485 §7.3, but for a Class I device with no NB review it may be proportionate/lightweight. US-market note: Class I is design-control-exempt (21 CFR 820.30(a)).')
      return req(`Full design & development file required — Class ${c.euClass} technical documentation (Annex II §6) is reviewed by a Notified Body.`)
    },
  },
  {
    id: 'device-description',
    name: 'Device Description & Specification (incl. variants/accessories)',
    category: 'Technical Documentation',
    isoClause: 'ISO 13485 §4.2.3',
    mdrRef: 'MDR Annex II §1',
    qmsrRef: 'QMSR → ISO 13485 §4.2.3',
    effortHours: 16,
    evaluate: () => req('Device description and specification is the first mandatory element of the technical documentation (Annex II §1) for all classes.'),
  },
  {
    id: 'labeling',
    name: 'Label & Labeling Set',
    category: 'Technical Documentation',
    isoClause: 'ISO 13485 §7.5.1',
    mdrRef: 'MDR Annex I §23.2',
    qmsrRef: 'QMSR §820.120 preserved labeling requirements',
    effortHours: 16,
    evaluate: () => req('Labels per Annex I §23.2 are mandatory for all devices, all classes.'),
  },
  {
    id: 'ifu',
    name: 'Instructions for Use (IFU)',
    category: 'Technical Documentation',
    isoClause: 'ISO 13485 §7.2.1',
    mdrRef: 'MDR Annex I §23.4',
    qmsrRef: 'QMSR labeling provisions',
    effortHours: 24,
    evaluate: (_p, c) => {
      if (c.euClass === 'I' || c.euClass === 'IIa')
        return cond('MDR Annex I §23.1(d): IFU may be OMITTED for Class I and IIa devices if they can be used safely without instructions. If your device qualifies, this document is eliminated — document the justification.')
      return req(`IFU is required — the Class ${c.euClass} exemption in Annex I §23.1(d) does not apply above Class IIa.`)
    },
  },
  {
    id: 'udi',
    name: 'UDI Assignment & Basic UDI-DI Record',
    category: 'Technical Documentation',
    isoClause: '—',
    mdrRef: 'MDR Art. 27 + Annex VI',
    qmsrRef: '21 CFR 830 (UDI rule)',
    effortHours: 8,
    evaluate: () => req('UDI assignment applies to all classes (MDR Art. 27); only the carrier-placement timeline differed by class and is now fully phased in.'),
  },
  {
    id: 'doc-of-conformity',
    name: 'EU Declaration of Conformity',
    category: 'Technical Documentation',
    isoClause: '—',
    mdrRef: 'MDR Art. 19 + Annex IV',
    qmsrRef: 'n/a (EU-specific)',
    effortHours: 4,
    evaluate: (p) =>
      p.market === 'US'
        ? elim('Device targets the US market only — the EU Declaration of Conformity (MDR Art. 19) does not apply.')
        : req('The EU Declaration of Conformity is mandatory for every device CE-marked under the MDR (Art. 19).'),
  },

  // ── Clinical ──
  {
    id: 'clinical-eval-plan',
    name: 'Clinical Evaluation Plan + Report (CEP/CER)',
    category: 'Clinical',
    isoClause: '—',
    mdrRef: 'MDR Art. 61 + Annex XIV Part A',
    qmsrRef: 'n/a (US analogue: valid scientific evidence, 21 CFR 860.7)',
    effortHours: 80,
    evaluate: (_p, c) => {
      if (c.euClass === 'I')
        return cond('Clinical evaluation is required for ALL classes (Art. 61(1)) — but for Class I it can typically rely on literature and equivalence, producing a much lighter CER. Do not skip; right-size.')
      return req(`Clinical evaluation per Art. 61 and Annex XIV is required; Class ${c.euClass} CERs face Notified Body scrutiny.`)
    },
  },
  {
    id: 'clinical-investigation',
    name: 'Clinical Investigation (pre-market study)',
    category: 'Clinical',
    isoClause: '—',
    mdrRef: 'MDR Art. 62 + Annex XV',
    qmsrRef: 'US analogue: IDE study (21 CFR 812)',
    effortHours: 400,
    evaluate: (p, c) => {
      if (c.euClass === 'III' || p.invasiveness === 'implantable')
        return req('Art. 61(4): clinical investigations shall be performed for implantable and Class III devices, unless the equivalence/legacy exemptions of Art. 61(4)–(6) apply — verify with RA.')
      return elim(`Not a Class III or implantable device — the Art. 61(4) clinical-investigation obligation does not apply to Class ${c.euClass}. Clinical evidence comes from the (right-sized) clinical evaluation instead.`)
    },
  },
  {
    id: 'sscp',
    name: 'Summary of Safety and Clinical Performance (SSCP)',
    category: 'Clinical',
    isoClause: '—',
    mdrRef: 'MDR Art. 32',
    qmsrRef: 'n/a',
    effortHours: 40,
    evaluate: (p, c) =>
      c.euClass === 'III' || p.invasiveness === 'implantable'
        ? req('Art. 32: an SSCP is required for implantable devices and Class III devices.')
        : elim(`SSCP applies only to implantables and Class III (Art. 32) — eliminated for this Class ${c.euClass} device.`),
  },
  {
    id: 'pmcf-plan',
    name: 'PMCF Plan & Evaluation Report',
    category: 'Clinical',
    isoClause: '—',
    mdrRef: 'MDR Annex XIV Part B',
    qmsrRef: 'US analogue: 522 post-market surveillance studies (only if ordered)',
    effortHours: 40,
    evaluate: (_p, c) => {
      if (c.euClass === 'I')
        return cond('PMCF is the default under Annex XIV Part B, but for a well-established Class I device a justification for NOT performing PMCF is permissible (Annex XIV §B.1) — document the justification instead of the program.')
      return req(`PMCF plan required under Annex XIV Part B for Class ${c.euClass}; feeds the PSUR.`)
    },
  },

  // ── Post-Market ──
  {
    id: 'pms-plan',
    name: 'Post-Market Surveillance Plan',
    category: 'Post-Market',
    isoClause: 'ISO 13485 §8.2.1',
    mdrRef: 'MDR Art. 84 + Annex III',
    qmsrRef: 'QMSR → ISO 13485 §8.2.1',
    effortHours: 24,
    evaluate: () => req('A PMS plan per Art. 84 / Annex III is required for every class — content is proportionate to risk class.'),
  },
  {
    id: 'psur',
    name: 'Periodic Safety Update Report (PSUR)',
    category: 'Post-Market',
    isoClause: '—',
    mdrRef: 'MDR Art. 86',
    qmsrRef: 'n/a',
    effortHours: 32,
    evaluate: (_p, c) =>
      c.euClass === 'I'
        ? elim('Class I devices are exempt from the PSUR (Art. 86 applies to Class IIa and up) — replaced by the lighter PMS report under Art. 85.')
        : req(`PSUR required for Class ${c.euClass} (Art. 86): ${c.euClass === 'IIa' ? 'update at least every 2 years' : 'update annually'}.`),
  },
  {
    id: 'pms-report',
    name: 'PMS Report (Class I)',
    category: 'Post-Market',
    isoClause: '—',
    mdrRef: 'MDR Art. 85',
    qmsrRef: 'n/a',
    effortHours: 12,
    evaluate: (_p, c) =>
      c.euClass === 'I'
        ? req('Class I devices produce the lighter PMS report under Art. 85 (instead of a PSUR).')
        : elim(`Class ${c.euClass} devices produce a PSUR under Art. 86 instead — the Art. 85 PMS report applies only to Class I.`),
  },
  {
    id: 'vigilance',
    name: 'Vigilance / Incident Reporting Procedure',
    category: 'Post-Market',
    isoClause: 'ISO 13485 §8.2.3',
    mdrRef: 'MDR Art. 87–89',
    qmsrRef: '21 CFR 803 (MDR reporting)',
    effortHours: 16,
    evaluate: () => req('Serious-incident reporting obligations (Art. 87) apply to all manufacturers, all classes.'),
  },

  // ── Product Verification ──
  {
    id: 'biocompat',
    name: 'Biocompatibility Evaluation (ISO 10993-1)',
    category: 'Product Verification',
    isoClause: 'ISO 13485 §7.3.6 (design verification)',
    mdrRef: 'MDR Annex I §10.1 + Annex II §6.1',
    qmsrRef: 'Recognized standard ISO 10993-1',
    effortHours: 60,
    evaluate: (p) =>
      hasBodyContact(p)
        ? req('Device has direct/indirect body contact — biological evaluation per ISO 10993-1 is required (Annex I §10.1).')
        : elim('No direct or indirect body contact — the biological-evaluation requirement of Annex I §10.1 is not triggered. Document the no-contact rationale in the risk file.'),
  },
  {
    id: 'sterilization-validation',
    name: 'Sterilization Validation (ISO 11135/11137/17665)',
    category: 'Product Verification',
    isoClause: 'ISO 13485 §7.5.7',
    mdrRef: 'MDR Annex I §11.4',
    qmsrRef: 'QMSR → ISO 13485 §7.5.7',
    effortHours: 60,
    evaluate: (p) =>
      p.sterile
        ? req('Device is supplied sterile — sterilization process validation is mandatory (ISO 13485 §7.5.7; Annex I §11.4).')
        : elim('Device is not supplied sterile — sterilization validation (ISO 13485 §7.5.7) is not applicable. State non-sterile status on the label.'),
  },
  {
    id: 'shelf-life',
    name: 'Shelf-Life / Stability Studies',
    category: 'Product Verification',
    isoClause: 'ISO 13485 §7.3.6',
    mdrRef: 'MDR Annex I §6 + Annex II §6.1',
    qmsrRef: 'Design verification evidence',
    effortHours: 40,
    evaluate: (p) =>
      p.sterile
        ? req('Sterile barrier integrity over the claimed shelf life must be demonstrated (Annex I §11.4/§6).')
        : cond('Required only if the device has performance characteristics that degrade over time (Annex I §6). If none, eliminate with a documented rationale.'),
  },
  {
    id: 'electrical-safety',
    name: 'Electrical Safety Testing (IEC 60601-1)',
    category: 'Product Verification',
    isoClause: 'ISO 13485 §7.3.6',
    mdrRef: 'MDR Annex I §14–§18',
    qmsrRef: 'Recognized standard IEC 60601-1',
    effortHours: 50,
    evaluate: (p) =>
      p.active
        ? req('Active (powered) device — electrical safety per IEC 60601-1 is required to satisfy Annex I §14–18.')
        : elim('Not an active device — IEC 60601-1 electrical safety testing is not applicable.'),
  },
  {
    id: 'emc',
    name: 'EMC Testing (IEC 60601-1-2)',
    category: 'Product Verification',
    isoClause: 'ISO 13485 §7.3.6',
    mdrRef: 'MDR Annex I §14.2(d)',
    qmsrRef: 'Recognized standard IEC 60601-1-2',
    effortHours: 40,
    evaluate: (p) =>
      p.active
        ? req('Active device — electromagnetic compatibility per IEC 60601-1-2 is required (Annex I §14.2).')
        : elim('Not an active device — EMC testing is not applicable.'),
  },
  {
    id: 'usability',
    name: 'Usability Engineering File (IEC 62366-1)',
    category: 'Product Verification',
    isoClause: 'ISO 13485 §7.3.3',
    mdrRef: 'MDR Annex I §5 (use error)',
    qmsrRef: 'Human factors guidance / recognized standard',
    effortHours: 50,
    evaluate: (p, c) => {
      if (p.softwareImpact !== 'none' || p.active || c.euClass === 'IIb' || c.euClass === 'III')
        return req('Device has a user interface with meaningful use-error risk — usability engineering per IEC 62366-1 addresses Annex I §5.')
      return cond('Formal usability file is proportionate to use-error risk. For a simple Class I device a documented use-error assessment in the risk file may suffice — justify the tailoring.')
    },
  },
  {
    id: 'process-validation',
    name: 'Production Process Validation Records',
    category: 'Product Verification',
    isoClause: 'ISO 13485 §7.5.6',
    mdrRef: 'MDR Annex IX §2.2',
    qmsrRef: 'QMSR → ISO 13485 §7.5.6',
    effortHours: 40,
    evaluate: (p) =>
      p.sterile
        ? req('Processes whose output cannot be fully verified (e.g. sterilization, sealing) must be validated (ISO 13485 §7.5.6).')
        : cond('Required only for processes whose output is not fully verifiable by inspection (ISO 13485 §7.5.6). If all outputs are verified, document that determination and eliminate.'),
  },

  // ── Software ──
  {
    id: 'software-lifecycle',
    name: 'Software Lifecycle File (IEC 62304)',
    category: 'Software',
    isoClause: 'ISO 13485 §7.3',
    mdrRef: 'MDR Annex I §17.2',
    qmsrRef: 'Recognized standard IEC 62304',
    effortHours: 100,
    evaluate: (p) =>
      hasSoftware(p)
        ? req('Device contains software — lifecycle documentation per IEC 62304 is required (Annex I §17.2: state-of-the-art development lifecycle).')
        : elim('Device contains no software — the entire IEC 62304 documentation set (development plan, SRS, architecture, unit/integration/system test records) is not applicable.'),
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity Documentation (MDCG 2019-16 / FDA §524B)',
    category: 'Software',
    isoClause: 'ISO 13485 §7.3',
    mdrRef: 'MDR Annex I §17.4',
    qmsrRef: 'FD&C Act §524B (cyber devices)',
    effortHours: 60,
    evaluate: (p) =>
      hasSoftware(p)
        ? req('Software device — IT-security documentation per Annex I §17.4 and MDCG 2019-16 is required; for the US, §524B applies to connected cyber devices.')
        : elim('No software / connectivity — cybersecurity documentation (Annex I §17.4) is not applicable.'),
  },
  {
    id: 'sw-validation-qms',
    name: 'QMS Software Validation (tools & production software)',
    category: 'Software',
    isoClause: 'ISO 13485 §4.1.6 / §7.5.6',
    mdrRef: '—',
    qmsrRef: 'QMSR → ISO 13485 §4.1.6',
    effortHours: 20,
    evaluate: () =>
      cond('Required only where software is USED in the QMS or production (ISO 13485 §4.1.6) — scope depends on your toolchain, not device class. Inventory tools first.'),
  },

  // ── Expansion tranche (verified citations) ──
  {
    id: 'complaint-handling',
    name: 'Complaint Handling Procedure & Records',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §8.2.2',
    mdrRef: 'MDR Art. 10(10)',
    qmsrRef: 'QMSR → ISO 13485 §8.2.2 (formerly 21 CFR 820.198)',
    effortHours: 16,
    evaluate: () =>
      req('Every manufacturer must operate a complaint-handling process feeding CAPA and vigilance (ISO 13485 §8.2.2; MDR Art. 10(10)) — class-independent.'),
  },
  {
    id: 'nonconforming-product',
    name: 'Control of Nonconforming Product',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §8.3',
    mdrRef: 'MDR Art. 10(9)',
    qmsrRef: 'QMSR → ISO 13485 §8.3',
    effortHours: 12,
    evaluate: () =>
      req('Identification, segregation and disposition of nonconforming product is a mandatory QMS process (ISO 13485 §8.3) — class-independent.'),
  },
  {
    id: 'calibration',
    name: 'Calibration & Monitoring-Equipment Control',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §7.6',
    mdrRef: 'MDR Art. 10(9)',
    qmsrRef: 'QMSR → ISO 13485 §7.6',
    effortHours: 12,
    evaluate: () =>
      cond('Required where monitoring/measuring equipment is used in production or QC (ISO 13485 §7.6) — scope depends on your manufacturing process, not device class. Most physical-device manufacturers need it; pure-software manufacturers can document non-applicability.'),
  },
  {
    id: 'batch-records',
    name: 'Device History / Batch Production Records',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §7.5.1 / §7.5.8',
    mdrRef: 'MDR Annex IX §2.2',
    qmsrRef: 'QMSR → ISO 13485 §7.5 (formerly 21 CFR 820.184 DHR)',
    effortHours: 20,
    evaluate: (p) =>
      p.softwareImpact !== 'none' && p.invasiveness === 'none' && !p.active
        ? cond('For standalone software, the production-record equivalent is the build/release record — document the mapping (ISO 13485 §7.5.1 applied to software release).')
        : req('Production and batch traceability records demonstrating manufacture per the QMS are required for every physical device (ISO 13485 §7.5.1/§7.5.8).'),
  },
  {
    id: 'packaging-validation',
    name: 'Packaging & Sterile-Barrier Validation (ISO 11607)',
    category: 'Product Verification',
    isoClause: 'ISO 13485 §7.5.11',
    mdrRef: 'MDR Annex I §11.4',
    qmsrRef: 'Recognized standard ISO 11607',
    effortHours: 48,
    evaluate: (p) =>
      p.sterile
        ? req('Supplied sterile — the sterile-barrier system must be validated to maintain sterility until use (Annex I §11.4; ISO 11607).')
        : elim('Not supplied sterile — sterile-barrier validation (Annex I §11.4) is not applicable; standard product-protection packaging is covered under ISO 13485 §7.5.11 preservation controls.'),
  },
  {
    id: 'installation-servicing',
    name: 'Installation & Servicing Procedures',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §7.5.3 / §7.5.4',
    mdrRef: '—',
    qmsrRef: 'QMSR → ISO 13485 §7.5.3/§7.5.4',
    effortHours: 16,
    evaluate: (p) =>
      p.active
        ? cond('Required if the device is installed at the point of use or serviced in the field (ISO 13485 §7.5.3/§7.5.4) — typical for powered equipment; document non-applicability if neither occurs.')
        : elim('Passive device with no installation or field-servicing activity — ISO 13485 §7.5.3/§7.5.4 do not apply.'),
  },
  {
    id: 'prrc',
    name: 'PRRC Designation Record (Art. 15)',
    category: 'QMS Core',
    isoClause: '—',
    mdrRef: 'MDR Art. 15',
    qmsrRef: 'n/a (EU-specific role)',
    effortHours: 4,
    evaluate: (p) =>
      p.market === 'US'
        ? elim('US-only market — the Person Responsible for Regulatory Compliance is an EU MDR obligation (Art. 15) and does not apply.')
        : req('A Person Responsible for Regulatory Compliance must be designated and their qualification documented (MDR Art. 15) — class-independent for EU market access.'),
  },
  {
    id: 'eudamed',
    name: 'EUDAMED Actor & Device Registration',
    category: 'Technical Documentation',
    isoClause: '—',
    mdrRef: 'MDR Art. 29 + Art. 31',
    qmsrRef: 'US analogue: FDA establishment registration & listing (21 CFR 807)',
    effortHours: 8,
    evaluate: (p) =>
      p.market === 'US'
        ? elim('US-only market — EUDAMED registration (Art. 29/31) does not apply; the US analogue is establishment registration and device listing under 21 CFR 807.')
        : req('Actor registration (SRN) and device/UDI registration in EUDAMED are required before placing on the EU market (Art. 29, Art. 31).'),
  },
  {
    id: 'cmr-substances',
    name: 'CMR / Endocrine-Disruptor Substances Justification',
    category: 'Technical Documentation',
    isoClause: '—',
    mdrRef: 'MDR Annex I §10.4',
    qmsrRef: 'n/a (EU-specific threshold justification)',
    effortHours: 16,
    evaluate: (p) =>
      p.invasiveness !== 'none' || p.channelsBlood || p.injuredSkinContact !== 'none'
        ? cond('Device (or its fluid path) contacts the body — if CMR 1A/1B or endocrine-disrupting substances exceed 0.1% w/w in relevant parts, a justification per Annex I §10.4.2 is required. Confirm with your materials inventory.')
        : elim('No body or fluid-path contact — the Annex I §10.4 substance-justification obligation is not triggered for this device.'),
  },
  {
    id: 'trend-reporting',
    name: 'Trend Reporting Procedure (Art. 88)',
    category: 'Post-Market',
    isoClause: 'ISO 13485 §8.2.1',
    mdrRef: 'MDR Art. 88',
    qmsrRef: 'n/a (EU-specific; US analogue: MDR trending under 803)',
    effortHours: 8,
    evaluate: (p) =>
      p.market === 'US'
        ? elim('US-only market — Art. 88 trend reporting is an EU obligation; US trending falls under 21 CFR 803 medical device reporting.')
        : req('A procedure for statistically significant trend reporting of non-serious incidents is required (MDR Art. 88) — part of the post-market surveillance system for all classes.'),
  },

  // ── Full-EU completion tranche ──
  {
    id: 'nb-conformity-records',
    name: 'Notified Body Conformity Assessment Records',
    category: 'Technical Documentation',
    isoClause: '—',
    mdrRef: 'MDR Art. 52 + Annex IX–XI',
    qmsrRef: 'n/a (EU conformity route; US analogue: premarket submission)',
    effortHours: 60,
    evaluate: (_p, c) =>
      c.notifiedBodyRequired
        ? req(`Class ${c.euClass}${c.specialLabels.length ? ' (' + c.specialLabels.join(', ') + ')' : ''} requires Notified Body involvement — conformity assessment records per Art. 52 and the applicable Annex IX–XI route must be maintained.`)
        : elim('Class I non-sterile, non-measuring, non-reusable-surgical — self-certification applies (Art. 52(7)); no Notified Body conformity assessment records exist for this device.'),
  },
  {
    id: 'implant-card',
    name: 'Implant Card & Patient Information (Art. 18)',
    category: 'Technical Documentation',
    isoClause: '—',
    mdrRef: 'MDR Art. 18',
    qmsrRef: 'n/a (EU-specific)',
    effortHours: 8,
    evaluate: (p) =>
      p.invasiveness === 'implantable'
        ? req('Implantable device — an implant card and patient information per Art. 18 must be supplied with the device (limited exemptions in Art. 18(3) for e.g. sutures/staples — verify applicability).')
        : elim('Not an implantable device — the Art. 18 implant-card obligation does not apply.'),
  },
  {
    id: 'change-control',
    name: 'Design & Process Change Control Procedure',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §7.3.9',
    mdrRef: 'MDR Annex IX §4.10 (substantial changes)',
    qmsrRef: 'QMSR → ISO 13485 §7.3.9',
    effortHours: 16,
    evaluate: () =>
      req('Control of design and development changes — including evaluation of significance against the certificate/technical documentation — is a mandatory QMS process (ISO 13485 §7.3.9) for every class.'),
  },
  {
    id: 'work-environment',
    name: 'Work Environment & Contamination Control',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §6.4',
    mdrRef: '—',
    qmsrRef: 'QMSR → ISO 13485 §6.4',
    effortHours: 16,
    evaluate: (p) =>
      p.sterile
        ? req('Supplied sterile — documented work-environment and contamination-control requirements (cleanroom, monitoring) apply to production (ISO 13485 §6.4).')
        : cond('Required where the work environment can affect product quality (ISO 13485 §6.4) — typical for cleanliness-sensitive production; document non-applicability otherwise (e.g. standalone software).'),
  },
  {
    id: 'traceability',
    name: 'Identification & Traceability Procedure',
    category: 'QMS Core',
    isoClause: 'ISO 13485 §7.5.8 / §7.5.9',
    mdrRef: 'MDR Art. 25',
    qmsrRef: 'QMSR → ISO 13485 §7.5.9',
    effortHours: 12,
    evaluate: (p) =>
      p.invasiveness === 'implantable'
        ? req('Implantable device — extended traceability records through the distribution chain are mandatory (ISO 13485 §7.5.9.2; MDR Art. 25).')
        : req('Product identification and traceability through production and distribution must be documented (ISO 13485 §7.5.8/§7.5.9; MDR Art. 25 economic-operator traceability).'),
  },
  {
    id: 'fsca-procedure',
    name: 'FSCA / Field Safety Notice Procedure',
    category: 'Post-Market',
    isoClause: 'ISO 13485 §8.3.3 (advisory notices)',
    mdrRef: 'MDR Art. 89',
    qmsrRef: 'US analogue: corrections & removals (21 CFR 806)',
    effortHours: 12,
    evaluate: (p) =>
      p.market === 'US'
        ? elim('US-only market — field safety corrective actions per Art. 89 are an EU obligation; the US analogue is reports of corrections and removals under 21 CFR 806.')
        : req('A documented process for field safety corrective actions and field safety notices (Art. 89; ISO 13485 §8.3.3) is required for every class.'),
  },
  {
    id: 'ar-mandate',
    name: 'EU Authorised Representative Mandate (Art. 11)',
    category: 'Technical Documentation',
    isoClause: '—',
    mdrRef: 'MDR Art. 11',
    qmsrRef: 'n/a (EU-specific; US analogue: US agent for foreign establishments)',
    effortHours: 4,
    evaluate: (p) =>
      p.market === 'US'
        ? elim('US-only market — an EU Authorised Representative (Art. 11) is not applicable.')
        : cond('Required only if the legal manufacturer is established outside the EU (Art. 11) — a written mandate with the AR must then be part of the documentation. Document the determination either way.'),
  },
]
