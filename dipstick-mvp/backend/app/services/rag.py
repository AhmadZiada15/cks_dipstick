"""
RAG Service — Retrieval-Augmented Generation using IRIS Vector Search
=====================================================================
Retrieves relevant clinical guideline chunks from InterSystems IRIS
vector store to ground LLM explanations in validated medical literature.

Falls back to in-memory numpy/sklearn cosine similarity if IRIS is
unavailable (e.g. iris package not installed, connection refused).

Guideline sources:
  - KDIGO 2024 CKD Evaluation and Management
  - NICE CKD Guidelines
  - AUA Microhematuria Guidelines
  - USPSTF UTI Screening
"""

import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Clinical guideline chunks — 18 real, clinically meaningful excerpts
# ---------------------------------------------------------------------------

GUIDELINE_CHUNKS: list[str] = [
    # 1-2: CKD staging and eGFR thresholds
    (
        "KDIGO 2024: CKD is classified into stages based on GFR: Stage 1 (G1) GFR >= 90 mL/min/1.73m2 "
        "with evidence of kidney damage; Stage 2 (G2) GFR 60-89; Stage 3a (G3a) GFR 45-59; "
        "Stage 3b (G3b) GFR 30-44; Stage 4 (G4) GFR 15-29; Stage 5 (G5) GFR < 15 or dialysis. "
        "Staging requires abnormality present for > 3 months to distinguish from acute kidney injury."
    ),
    (
        "KDIGO 2024: A sustained decrease in eGFR below 60 mL/min/1.73m2 confirmed on repeat testing "
        "at least 90 days apart constitutes CKD Stage 3 or higher regardless of other markers. "
        "eGFR should be estimated using the CKD-EPI 2021 creatinine equation without race adjustment. "
        "Cystatin C-based confirmation is recommended when eGFR is 45-59 mL/min/1.73m2."
    ),
    # 3-4: Albuminuria categories and ACR thresholds
    (
        "KDIGO 2024: Albuminuria is categorized as A1 (normal to mildly increased, ACR < 30 mg/g), "
        "A2 (moderately increased, ACR 30-300 mg/g, formerly 'microalbuminuria'), and "
        "A3 (severely increased, ACR > 300 mg/g, formerly 'macroalbuminuria'). "
        "Dipstick proteinuria of 1+ approximately corresponds to ACR 30-300 mg/g (A2 category)."
    ),
    (
        "KDIGO 2024: Persistent albuminuria category A2 or higher (ACR >= 30 mg/g) on two of three "
        "spot urine samples over 3 months confirms the presence of CKD even with normal GFR. "
        "Quantitative ACR measurement on a first-morning void is preferred over dipstick protein "
        "for CKD screening, though dipstick remains valuable for initial detection."
    ),
    # 5-6: Proteinuria and nephrology referral triggers
    (
        "KDIGO 2024: Referral to nephrology is recommended when ACR >= 300 mg/g (A3 category), "
        "when eGFR < 30 mL/min/1.73m2 (Stage G4-G5), or when there is a sustained decline in "
        "eGFR of more than 5 mL/min/1.73m2 per year. Dipstick proteinuria of 2+ or higher "
        "warrants urgent quantitative confirmation and nephrology evaluation."
    ),
    (
        "NICE CKD Guidelines: Persistent proteinuria (dipstick 1+ or greater on two or more "
        "occasions) should prompt quantitative measurement of albumin-to-creatinine ratio (ACR). "
        "Transient proteinuria can result from fever, exercise, UTI, or heart failure and does not "
        "necessarily indicate CKD. Always exclude UTI before attributing proteinuria to kidney disease."
    ),
    # 7-8: UTI dipstick interpretation
    (
        "NICE UTI Guidelines: In symptomatic adult women, a positive nitrite result has high "
        "specificity (> 90%) for bacteriuria but low sensitivity (45-60%) because not all "
        "uropathogens reduce nitrates. Leukocyte esterase has high sensitivity (75-96%) but "
        "lower specificity (65-80%). Combined positive nitrite AND leukocytes has a positive "
        "predictive value exceeding 95% for UTI in symptomatic patients."
    ),
    (
        "USPSTF UTI Screening: In asymptomatic non-pregnant adults, screening for bacteriuria "
        "is not recommended (Grade D). Leukocyte esterase alone is insufficient to diagnose UTI; "
        "clinical symptoms (dysuria, frequency, urgency) must be present. In pregnant women, "
        "screening urine culture at 12-16 weeks is recommended. Dipstick alone should not replace "
        "culture for definitive UTI diagnosis in complex or recurrent cases."
    ),
    # 9-10: Hematuria workup recommendations
    (
        "AUA Microhematuria Guidelines 2020: Microscopic hematuria is defined as >= 3 RBCs per "
        "high-power field on microscopy. Dipstick-positive blood should be confirmed with "
        "microscopic urinalysis. Causes include UTI, nephrolithiasis, glomerulonephritis, and "
        "urological malignancy. Risk stratification considers age, sex, smoking history, and "
        "degree of hematuria to guide workup intensity."
    ),
    (
        "AUA Microhematuria Guidelines 2020: Patients >= 35 years with confirmed microhematuria "
        "should undergo cystoscopy and CT urography to exclude malignancy. Younger low-risk "
        "patients may be monitored with repeat urinalysis at 6 months. Concurrent proteinuria, "
        "dysmorphic RBCs, or RBC casts suggest glomerular origin and warrant nephrology referral "
        "rather than urological workup."
    ),
    # 11-12: Glycosuria and diabetes screening
    (
        "ADA Standards of Care 2024: Glycosuria detected on dipstick indicates blood glucose "
        "typically exceeding the renal threshold of approximately 180 mg/dL (10 mmol/L). "
        "This warrants fasting plasma glucose, HbA1c, or oral glucose tolerance testing to "
        "evaluate for diabetes mellitus. Renal glycosuria without hyperglycemia is rare but "
        "possible due to proximal tubular dysfunction or SGLT2 inhibitor therapy."
    ),
    (
        "ADA Standards of Care 2024: In patients not known to have diabetes, urine glucose 1+ "
        "or higher on dipstick should prompt blood glucose assessment within one week. "
        "Patients on SGLT2 inhibitors (dapagliflozin, empagliflozin, canagliflozin) will "
        "normally show glycosuria as a pharmacological effect, and this should not be "
        "misinterpreted as uncontrolled diabetes."
    ),
    # 13-14: Ketones — DKA vs starvation interpretation
    (
        "ADA Standards of Care 2024: Urine ketones combined with elevated glucose on dipstick "
        "raises concern for diabetic ketoacidosis (DKA), a medical emergency. This combination "
        "warrants immediate blood glucose, serum ketones (beta-hydroxybutyrate), arterial blood "
        "gas, and basic metabolic panel. DKA criteria include pH < 7.3, bicarbonate < 18 mEq/L, "
        "and elevated anion gap."
    ),
    (
        "NICE Diabetes Guidelines: Isolated ketonuria without glycosuria is commonly seen in "
        "fasting states, low-carbohydrate diets, prolonged vomiting, or strenuous exercise and "
        "is typically benign. Starvation ketosis does not produce metabolic acidosis. "
        "Ketones 2+ or higher with concurrent glucose positive on dipstick should prompt urgent "
        "point-of-care capillary blood glucose and beta-hydroxybutyrate testing."
    ),
    # 15-16: SGLT2 inhibitors and CKD progression benefit
    (
        "KDIGO 2024: SGLT2 inhibitors (dapagliflozin, empagliflozin) are recommended for patients "
        "with CKD and eGFR >= 20 mL/min/1.73m2 with ACR >= 200 mg/g, or with heart failure, to "
        "slow CKD progression and reduce cardiovascular risk. DAPA-CKD and EMPA-KIDNEY trials "
        "demonstrated 30-40% relative risk reduction in CKD progression endpoints."
    ),
    (
        "KDIGO 2024: When interpreting dipstick urinalysis in patients on SGLT2 inhibitors, "
        "expect glycosuria as a pharmacological effect (not a sign of uncontrolled diabetes). "
        "An initial eGFR dip of 10-30% after SGLT2i initiation is expected and reversible. "
        "SGLT2 inhibitors may reduce albuminuria independently of glucose lowering, so "
        "follow-up dipstick may show improvement in proteinuria grade."
    ),
    # 17-18: Monitoring frequency for CKD patients
    (
        "KDIGO 2024: Monitoring frequency depends on CKD stage and albuminuria category. "
        "G1-G2 with A1: annual monitoring. G3a with A1: annual. G3a with A2: every 6 months. "
        "G3b: every 6 months minimum. G4-G5: every 3 months or more frequently. "
        "Each visit should include eGFR, ACR, blood pressure, and electrolyte panel."
    ),
    (
        "NICE CKD Guidelines: Patients with newly identified CKD should have eGFR repeated "
        "within 2 weeks if acute kidney injury is suspected, or within 90 days to confirm "
        "chronicity. For stable CKD G3a-A1, annual monitoring is sufficient. Accelerated "
        "decline (eGFR drop > 25% or > 15 mL/min/1.73m2 over 12 months) requires immediate "
        "investigation for reversible causes and nephrology referral."
    ),
]

# ---------------------------------------------------------------------------
# Mode selection — tried in order: IRIS → TF-IDF → numpy bag-of-words
# ---------------------------------------------------------------------------

_active_mode: str = "none"

# Mode 1 state (IRIS + sentence-transformers)
_iris_conn = None
_st_model = None

# Mode 2 state (sklearn TF-IDF)
_tfidf_vectorizer = None
_tfidf_matrix = None

# ---------------------------------------------------------------------------
# Mode 1: IRIS Vector Search + sentence-transformers
# ---------------------------------------------------------------------------

def _try_init_iris() -> bool:
    """Attempt to connect to IRIS and load sentence-transformers."""
    global _iris_conn, _st_model
    try:
        import iris  # type: ignore
        from sentence_transformers import SentenceTransformer

        _iris_conn = iris.connect("localhost:1972/USER", "SuperUser", "SYS")
        _st_model = SentenceTransformer("all-MiniLM-L6-v2")

        cursor = _iris_conn.cursor()

        # Create table if not exists
        cursor.execute(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
            "WHERE TABLE_SCHEMA = 'SQLUser' AND TABLE_NAME = 'GuidelineChunks'"
        )
        table_exists = cursor.fetchone()[0] > 0

        if not table_exists:
            cursor.execute(
                "CREATE TABLE SQLUser.GuidelineChunks ("
                "  id INT PRIMARY KEY, "
                "  chunk_text VARCHAR(2000), "
                "  embedding VECTOR(DOUBLE, 384)"
                ")"
            )
            _iris_conn.commit()

        # Seed data if table is empty
        cursor.execute("SELECT COUNT(*) FROM SQLUser.GuidelineChunks")
        row_count = cursor.fetchone()[0]

        if row_count == 0:
            logger.info("Seeding %d guideline chunks into IRIS vector store...", len(GUIDELINE_CHUNKS))
            embeddings = _st_model.encode(GUIDELINE_CHUNKS)
            for i, (chunk, emb) in enumerate(zip(GUIDELINE_CHUNKS, embeddings)):
                vec_str = ",".join(str(float(v)) for v in emb)
                cursor.execute(
                    "INSERT INTO SQLUser.GuidelineChunks (id, chunk_text, embedding) "
                    "VALUES (?, ?, TO_VECTOR(?))",
                    [i, chunk, vec_str],
                )
            _iris_conn.commit()
            logger.info("Seeded %d chunks into IRIS.", len(GUIDELINE_CHUNKS))

        return True

    except Exception as e:
        logger.debug("IRIS vector store init failed: %s", e)
        _iris_conn = None
        _st_model = None
        return False


def _retrieve_iris(query_text: str, top_k: int) -> list[str]:
    """Retrieve from IRIS using VECTOR_DOT_PRODUCT."""
    query_emb = _st_model.encode([query_text])[0]  # type: ignore[union-attr]
    vec_str = ",".join(str(float(v)) for v in query_emb)

    cursor = _iris_conn.cursor()  # type: ignore[union-attr]
    cursor.execute(
        "SELECT TOP ? chunk_text "
        "FROM SQLUser.GuidelineChunks "
        "ORDER BY VECTOR_DOT_PRODUCT(embedding, TO_VECTOR(?)) DESC",
        [top_k, vec_str],
    )
    return [row[0] for row in cursor.fetchall()]


# ---------------------------------------------------------------------------
# Mode 2: sklearn TF-IDF (fallback)
# ---------------------------------------------------------------------------

def _try_init_tfidf() -> bool:
    """Attempt to set up TF-IDF vectorizer."""
    global _tfidf_vectorizer, _tfidf_matrix
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer

        _tfidf_vectorizer = TfidfVectorizer(stop_words="english")
        _tfidf_matrix = _tfidf_vectorizer.fit_transform(GUIDELINE_CHUNKS)
        return True

    except Exception as e:
        logger.debug("TF-IDF init failed: %s", e)
        return False


def _retrieve_tfidf(query_text: str, top_k: int) -> list[str]:
    """Retrieve using cosine similarity on TF-IDF vectors."""
    from sklearn.metrics.pairwise import cosine_similarity

    query_vec = _tfidf_vectorizer.transform([query_text])  # type: ignore[union-attr]
    scores = cosine_similarity(query_vec, _tfidf_matrix).flatten()  # type: ignore[arg-type]
    top_indices = np.argsort(scores)[::-1][:top_k]
    return [GUIDELINE_CHUNKS[i] for i in top_indices]


# ---------------------------------------------------------------------------
# Mode 3: numpy bag-of-words (last resort)
# ---------------------------------------------------------------------------

def _retrieve_bow(query_text: str, top_k: int) -> list[str]:
    """Simple word overlap scoring — always works."""
    query_tokens = set(query_text.lower().split())
    scores = []
    for chunk in GUIDELINE_CHUNKS:
        chunk_tokens = set(chunk.lower().split())
        union = query_tokens | chunk_tokens
        intersection = query_tokens & chunk_tokens
        score = len(intersection) / len(union) if union else 0.0
        scores.append(score)

    top_indices = np.argsort(scores)[::-1][:top_k]
    return [GUIDELINE_CHUNKS[i] for i in top_indices]


# ---------------------------------------------------------------------------
# Initialization — run once at module import
# ---------------------------------------------------------------------------

def _init_rag() -> None:
    global _active_mode

    if _try_init_iris():
        _active_mode = "iris"
        logger.info("RAG mode: IRIS vector search")
    elif _try_init_tfidf():
        _active_mode = "tfidf"
        logger.info("RAG mode: TF-IDF in-memory (sklearn)")
    else:
        _active_mode = "bow"
        logger.info("RAG mode: numpy bag-of-words fallback")


_init_rag()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def retrieve_relevant_guidelines(query_text: str, top_k: int = 3) -> list[str]:
    """
    Return top_k most relevant guideline chunks for the query.
    Never raises — returns empty list on any failure.
    """
    try:
        if _active_mode == "iris":
            return _retrieve_iris(query_text, top_k)
        elif _active_mode == "tfidf":
            return _retrieve_tfidf(query_text, top_k)
        else:
            return _retrieve_bow(query_text, top_k)
    except Exception as e:
        logger.warning("RAG retrieval failed: %s", e)
        return []
