# Demo prompts for the Intake Parser Agent

Every prompt below was verified end-to-end on 2026-07-09: pasted into the live
Intake Parser (GPT-5.4) → parsed to a `DeviceProfile` → classified by the
deterministic engine, producing the expected class. Rules 4 (wound dressings)
and 12 (infusion pumps) are now implemented — those devices classify correctly.
Still avoid devices needing Rules 15–22 (contraceptives, disinfectants,
nanomaterials, inhaled/absorbed substances): not implemented.

| # | Device | Expected result |
|---|--------|-----------------|
| 1 | Acoustic stethoscope | Class I |
| 2 | Sterile surgical drape | Class I **Is** |
| 3 | Reusable surgical scissors | Class I **Ir** |
| 4 | Digital thermometer | Class IIa |
| 5 | Dermatology triage app | Class IIa (Rule 11) |
| 6 | Hemodialysis machine | Class IIb |
| 7 | AI sepsis-prediction SaMD | Class III (Rule 11) |
| 8 | ICU multi-parameter monitor | Class IIb (Rule 10) |

---

**1 · Acoustic stethoscope — Class I**

> A hand-held acoustic stethoscope placed on the patient's chest to listen to heart and lung sounds during routine examination. Entirely mechanical — no power source, no software, no measuring function. Reusable, supplied non-sterile. Sold in the EU and US.

**2 · Sterile surgical drape — Class Is**

> A single-use sterile surgical drape placed over the patient to maintain a sterile field during procedures. Non-invasive, passive fabric barrier with no power, software, or measuring function. Supplied sterile via ethylene oxide.

**3 · Reusable surgical scissors — Class Ir**

> Stainless-steel surgical scissors used by surgeons to cut soft tissue during open procedures. Purely mechanical, transient use inside the surgical wound, intended to be cleaned and re-sterilized and reused many times. No power source or software.

**4 · Digital thermometer — Class IIa**

> A battery-powered digital thermometer with an oral probe that measures and displays the patient's body temperature in about 10 seconds. Reusable with disposable probe covers. Has a measuring function; no treatment capability and no software beyond the firmware readout.

**5 · Dermatology triage app — Class IIa**

> A smartphone application that analyzes photos of skin lesions and provides a structured report to the dermatologist to support their diagnostic decision. Pure software, no hardware accessory. A wrong output would not by itself cause serious deterioration since the clinician reviews the images.

**6 · Hemodialysis machine — Class IIb**

> A powered bedside hemodialysis machine that pumps the patient's blood through an extracorporeal dialyser circuit to remove waste products and excess fluid, modifying the composition of the blood before returning it. It continuously monitors blood pressure, flow and temperature, where an undetected fault could immediately endanger the patient.

**7 · AI sepsis-prediction SaMD — Class III**

> A standalone AI software platform for the ICU that continuously analyzes vital signs and lab values to predict onset of sepsis hours in advance and recommends immediate clinical intervention. A missed or wrong prediction could directly lead to patient death. Software only, no hardware.

**8 · ICU multi-parameter monitor — Class IIb**

> A mains-powered multi-parameter patient monitor used in intensive care that continuously measures ECG, SpO2 and invasive blood pressure, and raises alarms when values become dangerous. Variations in these vital physiological parameters could result in immediate danger to the patient. Reusable, non-sterile.

---

**Demo tips**

- Prompts 1→7 make a good narrative arc: same tool, rigor visibly scaling with risk.
- After each parse, point at the *deciding rule* line and the all-hits expander —
  it shows the engine isn't a black box.
- The savings bar is the money shot on prompt 1 vs prompt 7 (~64% vs ~15%).
