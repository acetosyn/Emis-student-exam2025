# ============================================================
# convert.py — WAEC CBT EXTRACTOR (2025 GROUPED EDITION)
# Targets JSON FORMAT of chemistry_ss3.json
# Supports:
#  • Passages (e.g. Stock Exchange in English)
#  • Grouped sections (SECTION 1, 2, etc.)
#  • Instructions + ranges (e.g. "answer 31–35")
#  • Diagrams folder extraction (for later linking)
#  • Sub/sup formatting for sciences
#  • JSON sanitizing + numeric safety
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
BASE_DOCX     = "static/subjects/subjects-docx"
BASE_JSON     = "static/subjects/subjects-json"
BASE_DIAGRAMS = "static/uploads/diagrams"
ERROR_DUMP    = "static/json_errors"
os.makedirs(ERROR_DUMP, exist_ok=True)

# ============================================================
# SUBJECT DETECTION
# ============================================================
def detect_subject(filename: str) -> str:
    n = filename.lower()

    if "math" in n: return "Mathematics"
    if "chem" in n: return "Chemistry"
    if "eng" in n: return "English"
    if "literature" in n: return "Literature"
    if "account" in n: return "Accounts"
    if "civic" in n: return "Civic"
    if "computer" in n: return "Computer"
    if "econom" in n: return "Economics"
    if "govern" in n: return "Government"
    if "biology" in n: return "Biology"
    if "physic" in n: return "Physics"

    return "General"


def detect_class_category(filename: str) -> str:
    n = filename.lower()
    if "ss1" in n: return "SS1"
    if "ss2" in n: return "SS2"
    if "ss3" in n: return "SS3"
    return "GENERAL"

# ============================================================
# EXPECTED QUESTION COUNT
# ============================================================
def expected_question_count(filename: str) -> int:
    n = filename.lower()
    if "computer_ss1" in n: return 60
    if "english_ss2" in n: return 60
    if "english_ss3" in n: return 80
    return 50

# ============================================================
# DOCX PARSER (TEXT + DIAGRAMS)
# ============================================================
def extract_docx(path: str, diagram_out_dir: str):
    doc = Document(path)
    full_text_lines = []

    os.makedirs(diagram_out_dir, exist_ok=True)
    diagram_map = {}

    for p in doc.paragraphs:
        full_text_lines.append(p.text.strip())

    # Extract images
    img_index = 1
    rels = doc.part.rels
    for rel in rels:
        rel_obj = rels[rel]
        if "image" in rel_obj.target_ref:
            img_data = rel_obj.target_part.blob
            fname = f"diagram_{img_index}.PNG"
            out_path = os.path.join(diagram_out_dir, fname)

            with open(out_path, "wb") as f:
                f.write(img_data)

            static_path = out_path.replace("static", "/static")
            diagram_map[str(img_index)] = static_path

            img_index += 1

    return "\n".join(full_text_lines), diagram_map

# ============================================================
# CLEAN RAW LLM JSON
# ============================================================
def clean_llm_json(raw: str) -> str:
    if not raw:
        return "{}"

    raw = raw.strip()
    raw = raw.replace("```json", "").replace("```", "")
    raw = re.sub(r"[\x00-\x1F\x7F]", "", raw)

    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        raw = match.group(0)
    else:
        return "{}"

    raw = re.sub(r",\s*([\]}])", r"\1", raw)
    raw = re.sub(r'(\s*)([A-Za-z0-9_]+)\s*:', r'\1"\2":', raw)
    raw = re.sub(r",\s*,", ",", raw)

    raw = raw.replace("“", '"').replace("”", '"')
    return raw

# ============================================================
# SUBSCRIPT / SUPERSCRIPT FORMATTER
# ============================================================
SUB_SUP_SUBJECTS = {
    "chemistry", "mathematics", "further mathematics", "physics", "biology"
}

def apply_sub_sup_formatting(text: str, subject: str) -> str:
    if not text or subject.lower() not in SUB_SUP_SUBJECTS:
        return text

    def chem_repl(m):
        elem, num = m.group(1), m.group(2)
        if elem.upper() in {"SS", "WA", "Q"}:
            return m.group(0)
        return f"{elem}<sub>{num}</sub>"

    text = re.sub(r"([A-Z][a-z]?)(\d+)", chem_repl, text)
    text = re.sub(r"(\w)\^(\d+)", r"\1<sup>\2</sup>", text)
    return text

# ============================================================
# SIMPLE-MODE DETECTOR
# ============================================================
def is_simple_paper(text: str, subject: str) -> bool:
    subject = subject.lower()
    if subject in ["accounts", "civic", "government", "economics"]:
        return True

    t = text.lower()
    if "section" in t: return False
    if "use the" in t and "answer" in t: return False
    if "passage" in t: return False

    return True

# ============================================================
# MAIN LLM CALL (SIMPLE MODE + ADVANCED MODE)
# ============================================================
def ask_llm(subject: str, class_cat: str, text: str, expected_q: int) -> dict:

    simple = is_simple_paper(text, subject)

    if simple:
        # SIMPLE MODE PROMPT
        prompt = f"""
You are an expert WAEC MCQ extractor.

This exam is SIMPLE MODE:
- NO sections
- NO passages
- NO diagrams
- EXACTLY {expected_q} questions
- One group only.

Return ONLY VALID JSON:

{{
  "subject": "{subject}",
  "groups": [
    {{
      "start_id": 1,
      "end_id": {expected_q},
      "instruction": "ANSWER ALL QUESTIONS",
      "passage": "",
      "diagram": null,
      "question_ids": [{",".join(str(i) for i in range(1, expected_q+1))}]
    }}
  ],
  "questions": [
    {{
      "id": 1,
      "question": "text",
      "options": ["A. ...","B. ...","C. ...","D. ..."],
      "correctOption": "A"
    }}
  ]
}}

Extract strictly from:

{text}
"""
    else:
        # ADVANCED MODE PROMPT
        prompt = f"""
You are an expert WAEC MCQ extractor.

This exam may include:
- Sections
- Shared passages
- Instructions
- Diagrams

Ensure EXACTLY {expected_q} questions (IDs 1–{expected_q}).

Groups must include:
- start_id
- end_id
- instruction
- passage
- diagram
- question_ids

Questions must include:
- id
- question
- options: ["A. ...","B. ...","C. ...","D. ..."]
- correctOption: letter

Return ONLY VALID JSON.

Extract now:

{text}
"""

    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )

    cleaned = clean_llm_json(res.choices[0].message.content)

    try:
        return json.loads(cleaned)
    except Exception:
        repaired = re.sub(r'(\d{4,})', r'"\1"', cleaned)
        return json.loads(repaired)

# ============================================================
# NORMALIZER (CHEMISTRY_SS3 FORMAT)
# ============================================================
def normalize_output(data: dict, subject: str, class_cat: str, expected_q: int, diagram_map: dict):
    data["subject"] = subject

    # QUESTIONS
    questions = data.get("questions") or []
    if not isinstance(questions, list):
        raise ValueError("questions must be a list")

    for idx, q in enumerate(questions, start=1):
        q["id"] = idx
        q["question"] = apply_sub_sup_formatting(q.get("question",""), subject)

        opts = q.get("options") or []
        fixed = []
        for i,opt in enumerate(opts):
            clean = re.sub(r"^[A-Da-d][\.\)\-:\s]*","", opt).strip()
            clean = apply_sub_sup_formatting(clean, subject)
            fixed.append(f"{chr(65+i)}. {clean}")

        while len(fixed) < 4:
            fixed.append(f"{chr(65+len(fixed))}. ---")
        if len(fixed) > 4:
            fixed = fixed[:4]

        q["options"] = fixed

        co = q.get("correctOption") or "A"
        q["correctOption"] = co.strip().upper()[0]

    questions = questions[:expected_q]
    data["questions"] = questions

    # GROUPS
    groups = data.get("groups") or []
    if not groups:
        ids = list(range(1, expected_q+1))
        groups = [{
            "start_id": 1,
            "end_id": expected_q,
            "instruction": "ANSWER ALL QUESTIONS",
            "passage": "",
            "diagram": None,
            "question_ids": ids,
        }]
    else:
        for g in groups:
            g["instruction"] = (g.get("instruction") or "").strip()
            g["passage"] = g.get("passage") or ""
            d = g.get("diagram")
            g["diagram"] = diagram_map.get(str(d), None)
            qids = g.get("question_ids")
            if not qids:
                s,e = g.get("start_id"), g.get("end_id")
                if isinstance(s,int) and isinstance(e,int):
                    qids = list(range(s,e+1))
                else:
                    qids = []
            g["question_ids"] = qids

    groups.sort(key=lambda g: g.get("start_id",0))
    data["groups"] = groups

    data["class_category"] = class_cat
    return data

# ============================================================
# SAVE JSON
# ============================================================
def save_output(subject: str, class_cat: str, data: dict):
    folder = os.path.join(BASE_JSON, class_cat.upper())
    os.makedirs(folder, exist_ok=True)

    safe = subject.lower().replace(" ","_")
    out = os.path.join(folder, f"{safe}_{class_cat.lower()}.json")

    with open(out,"w",encoding="utf-8") as f:
        json.dump(data,f,indent=2,ensure_ascii=False)

    print(f"💾 Saved → {out}")
    return out

# ============================================================
# MAIN CONVERSION
# ============================================================
def convert_exam(path: str):
    filename = os.path.basename(path)
    subject = detect_subject(filename)
    class_cat = detect_class_category(filename)
    expected_q = expected_question_count(filename)

    print(f"\n📘 Processing {filename}")
    print(f"   Subject: {subject}")
    print(f"   Class:   {class_cat}")
    print(f"   Expect:  {expected_q} questions")

    diagram_dir = os.path.join(BASE_DIAGRAMS, f"{subject.lower()}_{class_cat.lower()}")
    text, diagram_map = extract_docx(path, diagram_dir)

    data = ask_llm(subject, class_cat, text, expected_q)
    data = normalize_output(data, subject, class_cat, expected_q, diagram_map)

    return subject, class_cat, data

# ============================================================
# BATCH PROCESSOR
# ============================================================
def process_all():
    print("\n=== 🚀 FULL CONVERSION START ===\n")
    for fn in sorted(os.listdir(BASE_DOCX)):
        if not fn.endswith(".docx"):
            continue
        path = os.path.join(BASE_DOCX, fn)
        try:
            sub,cat,data = convert_exam(path)
            save_output(sub,cat,data)
        except Exception as e:
            print(f"❌ ERROR converting {fn}: {e}")
            continue
    print("\n🎉 DONE.\n")

# ============================================================
# CLI
# ============================================================
if __name__ == "__main__":
    process_all()
