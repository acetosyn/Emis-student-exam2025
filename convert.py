# ============================================================
# convert.py — WAEC CBT EXTRACTOR (2025 FINAL PATCHED EDITION)
# Supports:
#  • Passages
#  • Grouped questions
#  • Maths diagrams extraction
#  • Poetry formatting
#  • Sub/sup formatting
#  • JSON sanitizing (prevents crashes)
#  • Numeric hallucination prevention
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
# PATH CONFIG — FLASK STATIC STRUCTURE
# ============================================================
BASE_DOCX = "static/subjects/subjects-docx"
BASE_JSON = "static/subjects/subjects-json"
BASE_DIAGRAMS = "static/uploads/diagrams"


# ============================================================
# DETECT SUBJECT / CLASS
# ============================================================
def detect_subject(filename: str) -> str:
    n = filename.lower()
    if "math" in n: return "Mathematics"
    if "chem" in n: return "Chemistry"
    if "eng" in n: return "English"
    if "literature" in n: return "Literature"
    if "account" in n: return "Accounts"
    return "General"


def detect_class_category(filename: str) -> str:
    n = filename.lower()
    if "ss1" in n: return "SS1"
    if "ss2" in n: return "SS2"
    if "ss3" in n: return "SS3"
    return "GENERAL"


def detect_version(filename: str) -> str:
    m = re.search(r"(\d+)", filename)
    return m.group(1) if m else "1"


def class_from_version(v: str) -> str:
    return {"1": "SS1", "2": "SS2", "3": "SS3"}.get(v, "GENERAL")


# ============================================================
# DOCX PARSER — TEXT + DIAGRAMS
# ============================================================
def extract_docx(path: str, diagram_out_dir: str):
    """
    Extract:
      • Paragraph text
      • Diagrams → static/uploads/diagrams/<subject_class>/
    """
    doc = Document(path)
    full_text_lines = []
    diagram_map = {}

    os.makedirs(diagram_out_dir, exist_ok=True)

    # Extract text
    for p in doc.paragraphs:
        t = p.text.strip()
        if t:
            full_text_lines.append(t)

    # Extract images
    img_index = 1
    rels = doc.part.rels

    for rel in rels:
        rel_obj = rels[rel]
        if "image" in rel_obj.target_ref:
            img_data = rel_obj.target_part.blob
            fname = f"diagram_{img_index}.png"
            out_path = os.path.join(diagram_out_dir, fname)

            with open(out_path, "wb") as f:
                f.write(img_data)

            # Flask static path
            static_path = out_path.replace("static", "/static")
            diagram_map[str(img_index)] = static_path
            img_index += 1

    return "\n".join(full_text_lines), diagram_map


# ============================================================
# CLEAN LLM JSON SAFELY (patched)
# ============================================================
def clean_llm_json(raw: str) -> str:
    """
    Cleans invalid JSON from LLM:
    - removes control chars
    - fixes quotes
    - fixes unescaped characters
    - extracts only the JSON object
    """
    raw = raw.strip()
    raw = raw.replace("```json", "").replace("```", "")

    # Remove invisible DOCX control chars
    raw = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", raw)

    # Normalize quotes
    raw = raw.replace("“", "\"").replace("”", "\"")
    raw = raw.replace("‘", "'").replace("’", "'")

    # Fix accidental backslash-newline combos
    raw = raw.replace("\\\n", "")

    # Extract JSON object
    m = re.search(r"(\{[\s\S]*\})", raw)
    if m:
        raw = m.group(1)

    return raw


# ============================================================
# SUBSCRIPT / SUPERSCRIPT FORMATTER
# ============================================================
SUB_SUP_SUBJECTS = {"chemistry", "mathematics", "further mathematics", "physics"}

def apply_sub_sup_formatting(text: str, subject: str = None) -> str:
    if not text or not subject:
        return text

    subj = subject.lower()
    if subj not in SUB_SUP_SUBJECTS:
        return text

    # Chemical subscripts → Al2O3
    def chem_repl(m):
        elem, num = m.group(1), m.group(2)
        if elem.upper() in {"SS", "WA", "Q"}:
            return m.group(0)
        return f"{elem}<sub>{num}</sub>"

    text = re.sub(r"([A-Z][a-z]?)(\d+)", chem_repl, text)

    # Mathematical exponents → x^2
    text = re.sub(r"(\w)\^(\d+)", r"\1<sup>\2</sup>", text)

    return text


# ============================================================
# LLM CALL — WITH NUMBER SAFETY
# ============================================================
def ask_llm(subject: str, text: str) -> dict:

    prompt = f"""
You are an expert WAEC MCQ extractor.

Extract into STRICT JSON ONLY.

IMPORTANT NUMBER RULES:
- ALL numbers (money, years, values) MUST be treated as TEXT.
- DO NOT convert numbers into long integers.
- Return numeric values EXACTLY as they appear in the document.
- Examples: "N50,000", "1983", "1494", "400,000" must remain EXACT strings.

STRICT SCHEMA:
{{
  "subject": "{subject}",
  "groups": [
    {{
      "start_id": 31,
      "end_id": 35,
      "instruction": "Use the information below...",
      "passage": "optional",
      "diagram": "optional",
      "question_ids": [31,32,33,34,35]
    }}
  ],
  "questions": [
    {{
      "id": 1,
      "question": "text",
      "options": [
        "A. ...",
        "B. ...",
        "C. ...",
        "D. ..."
      ],
      "correctOption": "A"
    }}
  ]
}}

RULES:
- Preserve passages EXACTLY.
- Preserve poetry EXACTLY.
- NEVER hallucinate diagrams.
- NEVER modify numbers.
- ONLY return valid JSON.
- NO commentary.

Extract the MCQs from:

{text}
"""

    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    cleaned = clean_llm_json(res.choices[0].message.content)

    # PRIMARY LOAD
    try:
        return json.loads(cleaned)

    except Exception:
        # Fallback: wrap any large numbers with quotes
        repaired = re.sub(r'(\d{4,})', r'"\1"', cleaned)

        return json.loads(repaired)


# ============================================================
# NORMALIZATION
# ============================================================
def normalize_output(data: dict, subject: str, diagram_map: dict):
    # Repair group diagrams
    for g in data.get("groups", []):
        if isinstance(g.get("diagram"), str):
            key = g["diagram"].replace("diagram_", "")
            g["diagram"] = diagram_map.get(key)

    # Apply formatting
    for q in data.get("questions", []):
        q["question"] = apply_sub_sup_formatting(q.get("question", ""), subject)

        fixed_opts = []
        for opt in q.get("options", []):
            o = re.sub(r"^[A-Da-d][.\)\-:\s]*", "", opt).strip()
            o = apply_sub_sup_formatting(o, subject)
            fixed_opts.append(f"{opt[0]}. {o}")

        q["options"] = fixed_opts

    return data


# ============================================================
# SAVE JSON OUTPUT
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
# MAIN CONVERSION
# ============================================================
def convert_exam(path: str):
    filename = os.path.basename(path)
    subject = detect_subject(filename)
    class_cat = detect_class_category(filename)
    version = detect_version(filename)

    if class_cat == "GENERAL":
        class_cat = class_from_version(version)

    print(f"\n📘 Processing: {filename}")
    print(f"   → Subject: {subject}")
    print(f"   → Class:   {class_cat}")

    # Extract text + diagrams
    diag_dir = os.path.join(BASE_DIAGRAMS, f"{subject.lower()}_{class_cat.lower()}")
    text, diagram_map = extract_docx(path, diag_dir)

    # LLM extraction
    print("🧠 Sending to LLM...")
    data = ask_llm(subject, text)

    # Normalize
    data = normalize_output(data, subject, diagram_map)
    data["class_category"] = class_cat

    return subject, class_cat, data


# ============================================================
# PROCESS ALL
# ============================================================
def process_all():
    print("\n=== 🚀 FULL CONVERSION START ===\n")

    for filename in sorted(os.listdir(BASE_DOCX)):
        if not filename.endswith(".docx"):
            continue

        path = os.path.join(BASE_DOCX, filename)
        try:
            subject, class_cat, data = convert_exam(path)
            save_output(subject, class_cat, data)
        except Exception as e:
            print(f"❌ ERROR converting {filename}: {e}")
            break

    print("\n🎉 DONE.\n")


# ============================================================
# CLI
# ============================================================
if __name__ == "__main__":
    process_all()
