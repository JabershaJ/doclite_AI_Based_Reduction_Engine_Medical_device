/**
 * Maps knowledge-base citation strings to the official published law text,
 * so every citation in the UI is one click from its source:
 *   MDR refs  → EUR-Lex consolidated text of Regulation (EU) 2017/745
 *   US refs   → eCFR (21 CFR part level — section-level URLs are not stable)
 *   ISO refs  → the ISO catalogue page (full text is paywalled by ISO)
 * Returns null when a reference has no citable source (e.g. '—', 'n/a').
 */

const MDR_HTML = 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02017R0745-20230320'

export function mdrUrl(ref: string): string | null {
  if (!ref || ref === '—' || ref === 'n/a' || !/MDR|Annex|Art\./.test(ref)) return null
  const art = ref.match(/Art\.?\s*(\d+)/)
  // Article anchors exist in the consolidated HTML; annex-only refs open the document top.
  return art ? `${MDR_HTML}#art_${art[1]}` : MDR_HTML
}

export function usUrl(ref: string): string | null {
  if (!ref || ref === '—' || /^n\/a/.test(ref)) return null
  const cfr = ref.match(/21 CFR (\d+)/)
  if (cfr) return `https://www.ecfr.gov/current/title-21/part-${cfr[1]}`
  if (/QMSR|820/.test(ref)) return 'https://www.ecfr.gov/current/title-21/part-820'
  return null
}

export function isoUrl(ref: string): string | null {
  if (!ref || ref === '—') return null
  if (/ISO 13485/.test(ref)) return 'https://www.iso.org/standard/59752.html'
  return null
}

/** Annex VIII (classification rules) — used from the classification card. */
export const ANNEX_VIII_URL = MDR_HTML
