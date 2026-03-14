"""
Plain-English Explanation Generator
=====================================
Phase 4 — LLM Explanation Layer

Role of LLM here:
  - Convert a FULLY structured InterpretationResult into patient-friendly language
  - The LLM is NOT making any clinical decisions
  - Every input to the LLM comes from the deterministic rule engine
  - The LLM is only a "translator" of structured data into readable prose

We use Anthropic Claude via the SDK.
Fallback: if ANTHROPIC_API_KEY is not set or call fails, we use
          a template-based generator so the app still works offline / in demo.

Prompt design:
  - System prompt establishes strict scope (explain only, do not diagnose)
  - User message is structured JSON → English conversion request
  - Temperature 0 for consistency
"""

import os
import json
import logging
from typing import Optional

from app.models.dipstick import InterpretationResult, Explanation, UrgencyLevel
from app.services.rag import retrieve_relevant_guidelines

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM-based explanation (Anthropic Claude)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a patient education assistant for a health screening app.
Your ONLY job is to convert structured dipstick urinalysis screening results
into clear, plain-English explanations that a non-medical person can understand.

STRICT RULES:
1. Do NOT add any new clinical conclusions beyond what is in the input JSON.
2. Do NOT diagnose any condition. Use language like "may suggest", "could indicate",
   "a possible sign of", "consider discussing with your doctor".
3. Keep the tone calm, informative, and supportive — never alarmist.
4. Always remind the user this is NOT a medical diagnosis.
5. Keep explanations concise — patients should be able to read them in under 2 minutes.
6. Do NOT mention medications, treatments, or dosages.
7. If urgency is HIGH, gently but clearly convey that prompt attention is needed.
"""

EXPLANATION_PROMPT_TEMPLATE = """
Convert this structured dipstick screening result into patient-friendly language.

INPUT:
{interpretation_json}

OUTPUT FORMAT (return valid JSON only, no markdown):
{{
  "summary": "<1-2 sentences: what the overall result means in plain language>",
  "finding_explanations": [
    "<plain-language explanation of finding 1>",
    "<plain-language explanation of finding 2>"
  ],
  "next_steps_narrative": "<1 short paragraph: what the patient should do next>",
  "urgency_statement": "<1 sentence about how soon to act>"
}}
"""


def _call_llm(interpretation: InterpretationResult) -> Optional[Explanation]:
    """Try to call Anthropic API. Returns None on failure."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.info("ANTHROPIC_API_KEY not set — using template fallback")
        return None

    try:
        import anthropic

        # Serialize only the fields the LLM needs (not the full FHIR bundle etc.)
        interp_dict = {
            "abnormal_findings": interpretation.abnormal_findings,
            "clinical_flags": [
                {
                    "label": f.label,
                    "severity": f.severity,
                    "reasoning": f.reasoning,
                }
                for f in interpretation.clinical_flags
            ],
            "urgency": interpretation.urgency.value,
            "recommended_provider": interpretation.recommended_provider,
            "secondary_provider": interpretation.secondary_provider,
            "recommended_actions": interpretation.recommended_actions,
            "why": interpretation.why,
            "disclaimer": interpretation.disclaimer,
        }

        # --- RAG: retrieve relevant clinical guideline chunks ---
        rag_query = (
            f"urinalysis dipstick findings: {', '.join(interpretation.abnormal_findings)}. "
            f"urgency: {interpretation.urgency.value}. "
            f"flags: {', '.join(f.id for f in interpretation.clinical_flags)}"
        )
        retrieved_chunks = retrieve_relevant_guidelines(rag_query, top_k=3)

        guidelines_section = ""
        if retrieved_chunks:
            chunks_text = "\n---\n".join(retrieved_chunks)
            guidelines_section = (
                f"\nCLINICAL GUIDELINES CONTEXT (use these to ground your explanations):\n"
                f"---\n{chunks_text}\n---\n"
            )

        interp_json_str = json.dumps(interp_dict, indent=2)
        prompt = (
            f"\nConvert this structured dipstick screening result into patient-friendly language.\n\n"
            f"INPUT:\n{interp_json_str}\n"
            f"{guidelines_section}\n"
            f"OUTPUT FORMAT (return valid JSON only, no markdown):\n"
            f'{{\n'
            f'  "summary": "<1-2 sentences: what the overall result means in plain language>",\n'
            f'  "finding_explanations": [\n'
            f'    "<plain-language explanation of finding 1>",\n'
            f'    "<plain-language explanation of finding 2>"\n'
            f'  ],\n'
            f'  "next_steps_narrative": "<1 short paragraph: what the patient should do next>",\n'
            f'  "urgency_statement": "<1 sentence about how soon to act>"\n'
            f'}}\n'
        )

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",   # Fast + cost-efficient for hackathon
            max_tokens=1024,
            temperature=0,                        # Deterministic output
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)

        return Explanation(
            summary=data["summary"],
            finding_explanations=data["finding_explanations"],
            next_steps_narrative=data["next_steps_narrative"],
            urgency_statement=data["urgency_statement"],
        )

    except Exception as e:
        logger.warning(f"LLM explanation failed: {e} — falling back to template")
        return None


# ---------------------------------------------------------------------------
# Template-based fallback (no API key needed)
# ---------------------------------------------------------------------------

URGENCY_STATEMENTS = {
    UrgencyLevel.LOW: (
        "These findings are mild. Consider discussing them at your next "
        "routine doctor's visit."
    ),
    UrgencyLevel.MODERATE: (
        "We suggest scheduling a doctor's appointment within the next few days "
        "to review these findings."
    ),
    UrgencyLevel.HIGH: (
        "Some findings may need prompt attention. We recommend contacting a "
        "healthcare provider within 24–48 hours."
    ),
}

FINDING_TEMPLATES = {
    "protein":    "Your urine contains protein, which is not normally present in large amounts. "
                  "This may suggest kidney stress, a urinary tract infection, or dehydration.",
    "blood":      "Traces of blood were detected in your urine. This can result from a urinary "
                  "tract infection, kidney stones, or physical activity. It warrants follow-up.",
    "leukocytes": "Elevated white blood cells were detected, which may suggest inflammation or "
                  "a possible urinary tract infection.",
    "nitrite":    "A positive nitrite result may suggest the presence of bacteria in your urine, "
                  "which can be a sign of a urinary tract infection.",
    "glucose":    "Glucose was detected in your urine. This may be related to blood sugar levels "
                  "and is worth discussing with your doctor.",
    "ketones":    "Ketones were detected, which can occur during fasting, low-carb dieting, or "
                  "illness. Combined with glucose, this warrants urgent attention.",
    "bilirubin":  "Bilirubin in urine is not normally present and may relate to liver function. "
                  "Follow-up liver tests are recommended.",
    "ph":         "Your urine pH is outside the typical range, which may reflect diet or "
                  "other factors.",
    "specific_gravity": "Your urine concentration is outside the normal range, which may "
                        "suggest dehydration or a kidney concentrating issue.",
}


def _template_explanation(interpretation: InterpretationResult) -> Explanation:
    """
    Pure template-based explanation — no LLM required.
    Used as fallback or in offline/demo mode.
    """
    flags = interpretation.clinical_flags
    urgency = interpretation.urgency
    findings = interpretation.abnormal_findings

    # Summary
    if not flags:
        summary = (
            "Your dipstick screening results appear mostly within expected ranges. "
            "No significant concerns were identified at this time."
        )
    elif urgency == UrgencyLevel.HIGH:
        summary = (
            "Your dipstick screening found several findings that may need prompt attention. "
            "We recommend contacting a healthcare provider soon for a full evaluation."
        )
    elif urgency == UrgencyLevel.MODERATE:
        summary = (
            "Your dipstick screening identified some findings worth discussing with a doctor. "
            "These may suggest a urinary tract issue or early kidney concern."
        )
    else:
        summary = (
            "Your dipstick screening identified minor findings that are worth monitoring. "
            "Routine follow-up with your doctor is recommended."
        )

    # Per-finding explanations
    finding_explanations = [
        FINDING_TEMPLATES.get(f, f"An abnormal value was detected for: {f}.")
        for f in findings
    ]

    if not finding_explanations:
        finding_explanations = ["No significant abnormal values were detected."]

    # Next steps
    if interpretation.recommended_provider:
        provider_line = f"Consider visiting a {interpretation.recommended_provider}."
    else:
        provider_line = "Consider following up with your primary care physician."

    actions_text = " ".join(f"• {a}" for a in interpretation.recommended_actions[:3])
    next_steps_narrative = (
        f"{provider_line} Suggested next steps include: {actions_text} "
        f"Remember: this screening is not a diagnosis — a clinician can provide "
        f"a full evaluation and guide your care."
    )

    urgency_statement = URGENCY_STATEMENTS[urgency]

    return Explanation(
        summary=summary,
        finding_explanations=finding_explanations,
        next_steps_narrative=next_steps_narrative,
        urgency_statement=urgency_statement,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_explanation(interpretation: InterpretationResult) -> Explanation:
    """
    Generate a patient-friendly explanation.
    Tries LLM first; falls back to template if unavailable.
    """
    llm_result = _call_llm(interpretation)
    if llm_result is not None:
        return llm_result
    return _template_explanation(interpretation)
