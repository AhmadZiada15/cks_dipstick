"""
Rule-Based Clinical Interpretation Engine
==========================================
Phase 4 — Deterministic clinical logic

Design principles:
  - No LLM involvement here. Every decision is traceable to a coded rule.
  - Rules mirror conservative clinical guidelines for urinalysis dipstick screening.
  - "May suggest" / "consider" language is baked into the rule outputs, not hallucinated.
  - Each rule is a standalone function returning Optional[ClinicalFlag].
  - Urgency is computed by aggregating flag severities.

Clinical references used:
  - AUA urinalysis guidelines (https://www.auanet.org/guidelines-and-quality/guidelines/microhematuria)
  - ACOG / USPSTF UTI screening recommendations
  - KDIGO CKD screening guidance (proteinuria thresholds)
  - UpToDate "Urinalysis in the diagnosis of kidney disease" (general approach)

Disclaimer: This logic is intended for screening/education only,
            not for clinical diagnosis.
"""

from typing import List, Optional
from app.models.dipstick import (
    DipstickValues, SemiQuant, NitriteResult, UrgencyLevel,
    ClinicalFlag, InterpretationResult, ClinicalIntake,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Numeric weight for each semi-quantitative level (used for comparison)
SEMIQUANT_WEIGHT = {
    SemiQuant.NEGATIVE: 0,
    SemiQuant.TRACE:    1,
    SemiQuant.PLUS_1:   2,
    SemiQuant.PLUS_2:   3,
    SemiQuant.PLUS_3:   4,
    SemiQuant.PLUS_4:   5,
}


def _w(val: SemiQuant) -> int:
    """Return numeric weight for a SemiQuant value."""
    return SEMIQUANT_WEIGHT.get(val, 0)


def _is_positive(val: SemiQuant) -> bool:
    """True if value is at or above trace level."""
    return _w(val) >= 1


def _is_significant(val: SemiQuant) -> bool:
    """True if value is 1+ or above (above trace)."""
    return _w(val) >= 2


# ---------------------------------------------------------------------------
# Individual rules
# Each rule returns Optional[ClinicalFlag]. None = rule not triggered.
# ---------------------------------------------------------------------------

def rule_proteinuria(vals: DipstickValues) -> Optional[ClinicalFlag]:
    """
    Proteinuria ≥ trace: may indicate kidney stress, early CKD, or other causes.
    ≥ 2+ warrants urgent nephrology consideration.
    """
    if not _is_positive(vals.protein):
        return None

    if _w(vals.protein) >= 3:   # 2+ or 3+
        return ClinicalFlag(
            id="proteinuria_significant",
            label="Significant Protein Detected",
            severity="critical",
            triggered_by=["protein"],
            reasoning=(
                f"Protein level {vals.protein.value} may indicate significant "
                "kidney dysfunction, nephrotic syndrome, or other serious conditions. "
                "Prompt evaluation is recommended."
            ),
        )
    else:  # trace or 1+
        return ClinicalFlag(
            id="proteinuria_mild",
            label="Mild Protein Detected",
            severity="warning",
            triggered_by=["protein"],
            reasoning=(
                f"Protein level {vals.protein.value} may suggest early kidney stress, "
                "UTI, dehydration, or strenuous exercise. Repeat testing is recommended."
            ),
        )


def rule_hematuria(vals: DipstickValues) -> Optional[ClinicalFlag]:
    """
    Blood ≥ trace: may indicate hematuria from kidney, bladder, or UTI causes.
    Combined with protein raises concern for glomerular origin.
    """
    if not _is_positive(vals.blood):
        return None

    combined_with_protein = _is_positive(vals.protein)
    severity = "critical" if (combined_with_protein and _is_significant(vals.blood)) else "warning"

    reasoning = (
        f"Blood level {vals.blood.value} may suggest hematuria "
        "(blood in urine), which can arise from urinary tract infections, "
        "kidney stones, bladder irritation, or — less commonly — kidney disease."
    )
    if combined_with_protein:
        reasoning += (
            " The combination of blood and protein is of greater concern and "
            "may suggest glomerular involvement; nephrology evaluation is advisable."
        )

    return ClinicalFlag(
        id="hematuria",
        label="Blood Detected in Urine",
        severity=severity,
        triggered_by=["blood"] + (["protein"] if combined_with_protein else []),
        reasoning=reasoning,
    )


def rule_uti_pattern(vals: DipstickValues) -> Optional[ClinicalFlag]:
    """
    Leukocytes ≥ 1+ AND/OR nitrite positive: classic UTI dipstick pattern.
    Sensitivity ~70-80%, specificity ~80-90% for UTI when both positive.
    """
    leu_positive = _is_significant(vals.leukocytes)   # ≥ 1+
    leu_trace    = _is_positive(vals.leukocytes)       # trace
    nit_positive = vals.nitrite == NitriteResult.POSITIVE

    if not (leu_positive or leu_trace or nit_positive):
        return None

    triggered = []
    if leu_positive or leu_trace:
        triggered.append("leukocytes")
    if nit_positive:
        triggered.append("nitrite")

    if leu_positive and nit_positive:
        # Classic UTI pattern — higher confidence
        return ClinicalFlag(
            id="uti_classic_pattern",
            label="Classic UTI Pattern",
            severity="critical",
            triggered_by=triggered,
            reasoning=(
                f"Leukocytes ({vals.leukocytes.value}) and positive nitrite together "
                "are a strong dipstick indicator of a possible bacterial urinary tract "
                "infection. Clinical evaluation and urine culture are recommended."
            ),
        )
    elif leu_positive:
        return ClinicalFlag(
            id="pyuria_without_nitrite",
            label="Elevated White Cells (Pyuria)",
            severity="warning",
            triggered_by=triggered,
            reasoning=(
                f"Leukocytes at {vals.leukocytes.value} suggest pyuria (white cells in urine), "
                "which may indicate a UTI, urethral irritation, or non-bacterial inflammation. "
                "Nitrite was not detected — this can occur with non-E. coli bacteria or dilute urine."
            ),
        )
    elif nit_positive:
        return ClinicalFlag(
            id="nitrite_without_leukocytes",
            label="Nitrite Positive",
            severity="warning",
            triggered_by=triggered,
            reasoning=(
                "Positive nitrite suggests gram-negative bacteriuria (e.g., E. coli). "
                "Though leukocytes are not significantly elevated, bacterial infection "
                "remains possible. Follow-up with urine culture is recommended."
            ),
        )
    else:
        # Trace leukocytes only
        return ClinicalFlag(
            id="trace_leukocytes",
            label="Trace White Cells",
            severity="info",
            triggered_by=triggered,
            reasoning=(
                "Trace leukocytes may be within normal limits for some individuals, "
                "but bears monitoring, especially with other abnormal findings."
            ),
        )


def rule_glycosuria(vals: DipstickValues) -> Optional[ClinicalFlag]:
    """
    Glucose ≥ 1+: may indicate hyperglycemia (diabetes) or renal glucosuria.
    """
    if not _is_significant(vals.glucose):
        return None

    return ClinicalFlag(
        id="glycosuria",
        label="Glucose Detected",
        severity="warning" if _w(vals.glucose) < 3 else "critical",
        triggered_by=["glucose"],
        reasoning=(
            f"Glucose level {vals.glucose.value} detected in urine (glycosuria). "
            "This may indicate elevated blood glucose (hyperglycemia) consistent with "
            "diabetes mellitus, or less commonly, renal tubular dysfunction. "
            "Fasting blood glucose or HbA1c testing is recommended."
        ),
    )


def rule_ketonuria(vals: DipstickValues) -> Optional[ClinicalFlag]:
    """
    Ketones ≥ 1+: may indicate diabetic ketoacidosis, starvation, or low-carb diet.
    Combined with glucose is a red flag for DKA.
    """
    if not _is_significant(vals.ketones):
        return None

    combined_glucose = _is_significant(vals.glucose)
    severity = "critical" if combined_glucose else "warning"

    reasoning = (
        f"Ketones at {vals.ketones.value} detected. This can occur with low-carbohydrate "
        "diets, prolonged fasting, or vomiting."
    )
    if combined_glucose:
        reasoning += (
            " Combined with elevated glucose, this pattern may suggest "
            "diabetic ketoacidosis (DKA) — seek emergency care."
        )

    return ClinicalFlag(
        id="ketonuria",
        label="Ketones Detected",
        severity=severity,
        triggered_by=["ketones"] + (["glucose"] if combined_glucose else []),
        reasoning=reasoning,
    )


def rule_bilirubinuria(vals: DipstickValues) -> Optional[ClinicalFlag]:
    """
    Bilirubin ≥ 1+: may indicate liver disease or biliary obstruction.
    """
    if not _is_significant(vals.bilirubin):
        return None

    return ClinicalFlag(
        id="bilirubinuria",
        label="Bilirubin Detected",
        severity="warning",
        triggered_by=["bilirubin"],
        reasoning=(
            f"Bilirubin {vals.bilirubin.value} is present in urine. Normally bilirubin "
            "is absent in urine. Its presence may suggest liver disease, hepatitis, "
            "or biliary tract obstruction. Liver function tests are recommended."
        ),
    )


def rule_abnormal_ph(vals: DipstickValues) -> Optional[ClinicalFlag]:
    """
    pH < 4.6 or > 8.5: may indicate acid-base disorders or infection.
    Alkaline pH with UTI findings increases specificity.
    """
    if vals.ph < 4.6:
        return ClinicalFlag(
            id="acidic_ph",
            label="Abnormally Acidic Urine",
            severity="info",
            triggered_by=["ph"],
            reasoning=(
                f"Urine pH of {vals.ph} is below normal range. This can occur with "
                "acidic diet, ketosis, or renal tubular acidosis. Usually not concerning alone."
            ),
        )
    elif vals.ph > 8.5:
        return ClinicalFlag(
            id="alkaline_ph",
            label="Abnormally Alkaline Urine",
            severity="info",
            triggered_by=["ph"],
            reasoning=(
                f"Urine pH of {vals.ph} is above normal range. Alkaline urine can occur "
                "with UTI (urea-splitting bacteria), recent meals, or metabolic alkalosis."
            ),
        )
    return None


def rule_abnormal_specific_gravity(vals: DipstickValues) -> Optional[ClinicalFlag]:
    """
    SG < 1.005 or > 1.025: concentration extremes may indicate kidney issues.
    """
    if vals.specific_gravity < 1.005:
        return ClinicalFlag(
            id="very_dilute_urine",
            label="Very Dilute Urine",
            severity="info",
            triggered_by=["specific_gravity"],
            reasoning=(
                f"Specific gravity {vals.specific_gravity} suggests very dilute urine. "
                "This may reflect high fluid intake, diabetes insipidus, or impaired "
                "concentrating ability of the kidneys."
            ),
        )
    elif vals.specific_gravity > 1.025:
        return ClinicalFlag(
            id="concentrated_urine",
            label="Concentrated Urine",
            severity="info",
            triggered_by=["specific_gravity"],
            reasoning=(
                f"Specific gravity {vals.specific_gravity} suggests concentrated urine, "
                "which may indicate dehydration. Concentrated urine can also make other "
                "dipstick readings appear more pronounced."
            ),
        )
    return None


# ---------------------------------------------------------------------------
# All rules registry
# ---------------------------------------------------------------------------

ALL_RULES = [
    rule_proteinuria,
    rule_hematuria,
    rule_uti_pattern,
    rule_glycosuria,
    rule_ketonuria,
    rule_bilirubinuria,
    rule_abnormal_ph,
    rule_abnormal_specific_gravity,
]


# ---------------------------------------------------------------------------
# Urgency computation
# ---------------------------------------------------------------------------

def _compute_urgency(flags: List[ClinicalFlag]) -> UrgencyLevel:
    """
    Urgency is driven by worst flag severity and total flag count.
    Rules:
      - Any 'critical' flag → at least MODERATE urgency
      - ≥2 critical flags   → HIGH
      - Only 'warning' flags and ≤2 total → MODERATE
      - Only 'info' flags or 0 flags → LOW
    """
    if not flags:
        return UrgencyLevel.LOW

    critical_count = sum(1 for f in flags if f.severity == "critical")
    warning_count  = sum(1 for f in flags if f.severity == "warning")

    if critical_count >= 2:
        return UrgencyLevel.HIGH
    elif critical_count == 1:
        return UrgencyLevel.MODERATE
    elif warning_count >= 2:
        return UrgencyLevel.MODERATE
    elif warning_count >= 1:
        return UrgencyLevel.MODERATE
    else:
        return UrgencyLevel.LOW


# ---------------------------------------------------------------------------
# Provider recommendation
# ---------------------------------------------------------------------------

def _recommend_providers(flags: List[ClinicalFlag], urgency: UrgencyLevel):
    """
    Returns (primary_provider, secondary_provider) based on flag patterns.
    Conservative: always recommend seeing someone.
    """
    flag_ids = {f.id for f in flags}

    # Check for DKA-like pattern
    if "ketonuria" in flag_ids and "glycosuria" in flag_ids:
        return "Emergency Department", None

    # Prioritize critical flags
    if urgency == UrgencyLevel.HIGH:
        if any(fid in flag_ids for fid in ["proteinuria_significant", "hematuria"]):
            return "Primary Care Physician", "Nephrologist"
        if "uti_classic_pattern" in flag_ids:
            return "Urgent Care or Primary Care", None
        return "Primary Care Physician", None

    # Moderate: UTI pattern → urgent care; kidney pattern → PCP + nephro referral
    if urgency == UrgencyLevel.MODERATE:
        if "uti_classic_pattern" in flag_ids or "pyuria_without_nitrite" in flag_ids:
            return "Urgent Care or Primary Care", None
        if any(fid in flag_ids for fid in ["proteinuria_mild", "proteinuria_significant"]):
            return "Primary Care Physician", "Nephrologist (if confirmed)"
        if "glycosuria" in flag_ids:
            return "Primary Care Physician", "Endocrinologist (if confirmed)"
        return "Primary Care Physician", None

    # Low: routine follow-up
    return "Primary Care Physician (routine)", None


# ---------------------------------------------------------------------------
# Action and reasoning builder
# ---------------------------------------------------------------------------

def _build_actions_and_why(
    flags: List[ClinicalFlag],
    urgency: UrgencyLevel,
) -> tuple[List[str], List[str]]:
    """
    Returns parallel lists: recommended_actions and why (traceability).
    Each action entry in 'why' maps to the same index in 'actions'.
    """
    actions = []
    why = []

    flag_ids = {f.id for f in flags}

    # Always recommend re-testing if confidence could be an issue
    actions.append(
        "Confirm findings: repeat dipstick or proceed with laboratory urinalysis"
    )
    why.append(
        "Dipstick is a screening tool; laboratory urinalysis provides greater accuracy."
    )

    if "uti_classic_pattern" in flag_ids:
        actions.append("Request a urine culture and sensitivity test")
        why.append(
            "Triggered by: elevated leukocytes + positive nitrite — consistent with "
            "bacterial UTI. Culture confirms organism and guides antibiotic choice."
        )

    if "pyuria_without_nitrite" in flag_ids or "nitrite_without_leukocytes" in flag_ids:
        actions.append("Request a urine culture to clarify possible infection")
        why.append(
            "Triggered by: pyuria or nitrite positivity — possible UTI even without "
            "both markers being positive."
        )

    if any(fid in flag_ids for fid in ["proteinuria_mild", "proteinuria_significant"]):
        actions.append(
            "Request a urine albumin-to-creatinine ratio (ACR) and basic metabolic panel"
        )
        why.append(
            "Triggered by: elevated protein — ACR quantifies proteinuria; "
            "creatinine and BUN assess kidney function."
        )

    if "hematuria" in flag_ids:
        actions.append(
            "Report blood in urine to your physician; microscopic urinalysis "
            "and possible renal imaging may be ordered"
        )
        why.append(
            "Triggered by: blood detected — origin (kidney, bladder, other) "
            "requires further workup to rule out serious causes."
        )

    if "glycosuria" in flag_ids:
        actions.append("Request fasting blood glucose and HbA1c")
        why.append(
            "Triggered by: glucose in urine — screening for diabetes mellitus "
            "or renal glucose wasting."
        )

    if "ketonuria" in flag_ids:
        if "glycosuria" in flag_ids:
            actions.append("Seek emergency evaluation immediately (possible DKA)")
            why.append(
                "Triggered by: glucose + ketones — pattern consistent with possible "
                "diabetic ketoacidosis, a medical emergency."
            )
        else:
            actions.append("Ensure adequate food and fluid intake; discuss with a physician")
            why.append("Triggered by: ketones — may reflect fasting, vomiting, or low-carb diet.")

    if "bilirubinuria" in flag_ids:
        actions.append("Request liver function tests (LFTs)")
        why.append(
            "Triggered by: bilirubin in urine — may reflect hepatic or biliary disease."
        )

    # Urgency-based safety-net actions
    if urgency == UrgencyLevel.HIGH:
        actions.append("Seek medical evaluation promptly — do not delay more than 24-48 hours")
        why.append("Multiple significant findings detected — timely evaluation is important.")
    elif urgency == UrgencyLevel.MODERATE:
        actions.append(
            "Schedule an appointment with your physician within the next few days"
        )
        why.append("Moderate concern level detected based on dipstick findings.")
    else:
        actions.append("Discuss these results at your next routine medical visit")
        why.append("Findings are mild; routine follow-up is appropriate.")

    return actions, why


# ---------------------------------------------------------------------------
# Screening pathway routing
# ---------------------------------------------------------------------------

def derive_screening_pathway(intake: Optional[ClinicalIntake]) -> str:
    """
    Determine the primary screening pathway based on clinical intake.
    Returns: 'ckd' | 'uti' | 'diabetes' | 'mixed' | 'general'
    """
    if intake is None:
        return "general"
    if intake.is_pregnant:
        return "mixed"
    if intake.has_diabetes and intake.has_hypertension:
        return "ckd"
    if intake.has_diabetes:
        return "mixed"
    if intake.has_frequent_utis or intake.symptom_burning_urination or intake.symptom_pelvic_pain:
        return "uti"
    if intake.has_hypertension or intake.has_ckd_family_history:
        return "ckd"
    if intake.symptom_swelling or intake.symptom_foamy_urine:
        return "ckd"
    return "general"


def _compute_risk_score(flags: List[ClinicalFlag], intake: Optional[ClinicalIntake]) -> float:
    """Compute a 0.0-10.0 composite risk score."""
    critical = sum(1 for f in flags if f.severity == "critical")
    warning = sum(1 for f in flags if f.severity == "warning")
    info = sum(1 for f in flags if f.severity == "info")
    base = critical * 2.5 + warning * 1.0 + info * 0.2

    modifier = 0.0
    if intake:
        if intake.has_diabetes:
            modifier += 1.5
        if intake.has_hypertension:
            modifier += 1.0
        if intake.has_ckd_family_history:
            modifier += 0.5
        if intake.age and intake.age > 60:
            modifier += 0.5
        has_any_symptom = any([
            intake.symptom_swelling, intake.symptom_fatigue,
            intake.symptom_urination_changes, intake.symptom_back_pain,
            intake.symptom_foamy_urine, intake.symptom_burning_urination,
            intake.symptom_frequent_urination, intake.symptom_pelvic_pain,
        ])
        if has_any_symptom:
            modifier += 0.3

    return min(10.0, round(base + modifier, 1))


# ---------------------------------------------------------------------------
# Main interpretation function
# ---------------------------------------------------------------------------

def interpret(vals: DipstickValues, intake: Optional[ClinicalIntake] = None) -> InterpretationResult:
    """
    Run all rules against the dipstick values and return a structured
    InterpretationResult. This is the ONLY function the API layer calls.
    """

    # 1. Run all rules
    flags: List[ClinicalFlag] = []
    for rule_fn in ALL_RULES:
        flag = rule_fn(vals)
        if flag is not None:
            flags.append(flag)

    # 1b. Intake-aware flag adjustments
    pathway = derive_screening_pathway(intake)

    if intake:
        # Diabetic proteinuria upgrade
        if intake.has_diabetes and _is_positive(vals.protein):
            for i, f in enumerate(flags):
                if f.id in ("proteinuria_mild",) and f.severity == "warning":
                    flags[i] = f.model_copy(update={
                        "severity": "critical",
                        "reasoning": f.reasoning + " Diabetic proteinuria is higher risk for CKD progression.",
                    })

        # Pregnancy + protein → preeclampsia screen
        if intake.is_pregnant and _is_positive(vals.protein):
            flags.append(ClinicalFlag(
                id="preeclampsia_screen",
                label="Protein in pregnancy — screen for preeclampsia",
                severity="critical",
                triggered_by=["protein"],
                reasoning=(
                    "Proteinuria in pregnancy requires immediate evaluation to rule out "
                    "preeclampsia. This is a medical emergency if accompanied by hypertension."
                ),
            ))

        # Recurrent UTI upgrade
        if intake.has_frequent_utis:
            for i, f in enumerate(flags):
                if f.id == "uti_classic_pattern" and f.severity != "critical":
                    flags[i] = f.model_copy(update={
                        "severity": "critical",
                        "reasoning": f.reasoning + " Recurrent UTI history increases risk of upper tract involvement.",
                    })

    # 2. Collect abnormal field names
    abnormal_fields = set()
    for flag in flags:
        abnormal_fields.update(flag.triggered_by)
    abnormal_findings = sorted(list(abnormal_fields))

    # 3. Compute urgency
    urgency = _compute_urgency(flags)

    # 4. Provider recommendation
    primary, secondary = _recommend_providers(flags, urgency)

    # 5. Actions and traceability
    actions, reasoning_why = _build_actions_and_why(flags, urgency)

    # 6. Evidence links (static references for the rule set used)
    evidence_links = [
        "https://www.auanet.org/guidelines-and-quality/guidelines/microhematuria",
        "https://kdigo.org/guidelines/ckd-evaluation-and-management/",
        "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/urinary-tract-infections-in-adults-screening",
    ]

    risk_score = _compute_risk_score(flags, intake)

    return InterpretationResult(
        abnormal_findings=abnormal_findings,
        clinical_flags=flags,
        urgency=urgency,
        screening_pathway=pathway,
        risk_score=risk_score,
        recommended_provider=primary,
        secondary_provider=secondary,
        recommended_actions=actions,
        why=reasoning_why,
        evidence_links=evidence_links,
    )
