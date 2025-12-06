# ============================================================
# convert.py — WAEC CBT EXTRACTOR (2025 DIAGRAM VERSION + JSON REPAIR)
# ------------------------------------------------------------
# • Uses manual diagrams only
# • ZERO docx image extraction
# • Ultra-safe JSON repair (Option A)
# • Never crashes from malformed LLM output
# ============================================================

import os
import re
import json
from groq import Groq
from dotenv import load_dotenv
from docx import Document

# ============================================================
# LOAD ENV / INIT CLIENT
# ============================================================
load_dotenv()
API_KEY = os.getenv("GROQ_API_KEY")
if not API_KEY:
    raise Exception("❌ Missing GROQ_API_KEY in .env")

client = Groq(api_key=API_KEY)

# ============================================================
# PATHS
# ============================================================
BASE_DOCX = "static/subjects/subjects-docx"
BASE_JSON = "static/subjects/subjects-json"
BASE_DIAGRAMS = "static/uploads/diagrams"
ERROR_DUMP = "static/json_errors"
os.makedirs(ERROR_DUMP, exist_ok=True)


# ============================================================
# SUBJECT + CLASS DETECTION
# ============================================================
def detect_subject(filename: str) -> str:
    n = filename.lower()
    if "math" in n: return "Mathematics"
    if "chem" in n: return "Chemistry"
    if "eng" in n: return "English"
    if "literature" in n: return "Literature"
    if "account" in n: return "Accounts"
    if "computer" in n: return "Computer"
    if "biology" in n: return "Biology"
    if "physics" in n: return "Physics"
    if "government" in n: return "Government"
    if "civic" in n: return "Civic"
    if "economics" in n: return "Economics"
    return "General"


def detect_class_category(filename: str) -> str:
    n = filename.lower()
    if "ss1" in n: return "SS1"
    if "ss2" in n: return "SS2"
    if "ss3" in n: return "SS3"
    return "GENERAL"


# ============================================================
# JSON REPAIR ENGINE (OPTION A)
# ============================================================
def extract_json_block(text: str) -> str:
    """Extract the largest {...} JSON-like block from LLM output."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return text
    return text[start:end+1]


def basic_clean(text: str) -> str:
    """Remove control chars and normalize quotes."""
    text = text.replace("```json", "").replace("```", "")
    text = re.sub(r"[\x00-\x1f]", "", text)
    text = text.replace("“", "\"").replace("”", "\"")
    text = text.replace("‘", "'").replace("’", "'")
    text = text.replace("\\\n", "")
    return text


def fix_trailing_commas(text: str) -> str:
    text = re.sub(r",\s*([\]}])", r"\1", text)
    return text


def fix_missing_commas(text: str) -> str:
    text = re.sub(r"\"(\s*?)\"(\s*?)\"", "\", \"", text)
    return text


def fix_unquoted_keys(text: str) -> str:
    text = re.sub(r"(\s)([a-zA-Z0-9_]+):", r' "\2":', text)
    return text


def json_repair(raw: str, filename: str):
    """
    Attempt 3-stage JSON repair:
    1. Direct load
    2. Repaired load
    3. Fallback structural fix
    """
    cleaned = basic_clean(raw)
    block = extract_json_block(cleaned)

    # Attempt 1 — direct
    try:
        return json.loads(block)
    except Exception:
        pass

    # Attempt 2 — repaired
    repaired = block
    repaired = fix_trailing_commas(repaired)
    repaired = fix_unquoted_keys(repaired)

    try:
        return json.loads(repaired)
    except Exception:
        pass

    # Attempt 3 — fallback: quote numbers, repair arrays
    fallback = repaired
    fallback = re.sub(r'(\d+)(\s*?)"', r'"\1"', fallback)
    fallback = re.sub(r'",\s*}', '"}', fallback)
    fallback = re.sub(r'",\s*]', '"]', fallback)

    try:
        return json.loads(fallback)
    except Exception as e:
        # Final fail — dump output
        dump_path = os.path.join(ERROR_DUMP, f"{filename}_raw.txt")
        with open(dump_path, "w", encoding="utf-8") as f:
            f.write(raw)

        raise Exception(f"❌ JSON parse FAILED for {filename}. Raw dumped to {dump_path}\nError: {e}")


# ============================================================
# SUBSCRIPT / SUPERSCRIPT FORMATTER
# ============================================================
SUB_SUP_SUBJECTS = {"chemistry", "mathematics", "further mathematics", "physics"}

def apply_sub_sup_formatting(text: str, subject: str) -> str:
    if not text or subject.lower() not in SUB_SUP_SUBJECTS:
        return text
    text = re.sub(r"([A-Z][a-z]?)(\d+)", r"\1<sub>\2</sub>", text)
    text = re.sub(r"(\w)\^(\d+)", r"\1<sup>\2</sup>", text)
    return text


# ============================================================
# LLM EXTRACTION
# ============================================================
def ask_llm(subject: str, text: str, filename: str) -> dict:

    prompt = f"""
You are an expert WAEC MCQ extractor.

TASK:
- Extract MCQs in STRICT JSON.
- Detect group instructions (e.g., “Answer questions 12–15…”).
- DO NOT hallucinate diagrams.
- DO NOT change numbers.

OUTPUT ONLY VALID JSON. NO COMMENTARY.

JSON FORMAT:
{{
  "subject": "{subject}",
  "groups": [...],
  "questions": [...]
}}

Extract from this text:

{text}
"""

    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    raw = resp.choices[0].message.content
    return json_repair(raw, filename)


# ============================================================
# DIAGRAM MAPPING
# ============================================================
def attach_manual_diagrams(data: dict, subject: str, class_cat: str):
    folder = os.path.join(BASE_DIAGRAMS, f"{subject.lower()}_{class_cat.lower()}")

    if not os.path.exists(folder):
        return data

    available = {f.lower(): f for f in os.listdir(folder)}

    # Groups
    for g in data.get("groups", []):
        sid = g.get("start_id")
        if sid:
            fname = f"diagram_{sid}.png".lower()
            if fname in available:
                g["diagram"] = f"/static/uploads/diagrams/{subject.lower()}_{class_cat.lower()}/{available[fname]}"

    # Questions
    for q in data.get("questions", []):
        qid = q.get("id")
        if not qid:
            continue
        fname = f"diagram_{qid}.png".lower()
        if fname in available:
            q["diagram"] = f"/static/uploads/diagrams/{subject.lower()}_{class_cat.lower()}/{available[fname]}"
        else:
            q["diagram"] = None

    return data


# ============================================================
# NORMALIZATION
# ============================================================
def normalize_output(data: dict, subject: str, class_cat: str):

    for q in data.get("questions", []):
        q["question"] = apply_sub_sup_formatting(q.get("question", ""), subject)

        opts = []
        for opt in q.get("options", []):
            clean = re.sub(r"^[A-Da-d][\.\)\-:\s]*", "", opt)
            clean = apply_sub_sup_formatting(clean, subject)
            opts.append(f"{opt[0]}. {clean}")
        q["options"] = opts

    return attach_manual_diagrams(data, subject, class_cat)


# ============================================================
# SAVE JSON
# ============================================================
def save_output(subject: str, class_category: str, data: dict):
    folder = os.path.join(BASE_JSON, class_category.upper())
    os.makedirs(folder, exist_ok=True)

    safe = subject.lower().replace(" ", "_")
    out_path = os.path.join(folder, f"{safe}_{class_category.lower()}.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved → {out_path}")
    return out_path


# ============================================================
# MAIN EXAM CONVERTER
# ============================================================
def convert_exam(path: str):
    filename = os.path.basename(path)
    subject = detect_subject(filename)
    class_cat = detect_class_category(filename)

    print(f"\n📘 Processing: {filename}  ({subject}, {class_cat})")

    text = "\n".join([p.text for p in Document(path).paragraphs])
    print("🧠 Sending to LLM...")

    data = ask_llm(subject, text, filename)
    data = normalize_output(data, subject, class_cat)
    data["class_category"] = class_cat

    return subject, class_cat, data


# ============================================================
# BATCH PROCESSOR
# ============================================================
def process_all():
    print("\n=== 🚀 FULL CONVERSION START ===\n")

    for filename in sorted(os.listdir(BASE_DOCX)):
        if filename.endswith(".docx"):
            try:
                subject, class_cat, data = convert_exam(os.path.join(BASE_DOCX, filename))
                save_output(subject, class_cat, data)
            except Exception as e:
                print(f"❌ ERROR converting {filename}: {e}")

    print("\n🎉 DONE.\n")


# ============================================================
# CLI
# ============================================================
if __name__ == "__main__":
    process_all()
