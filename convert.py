# convert.py
import os
import json
import re
from groq import Groq
from dotenv import load_dotenv
from docx import Document

# ============================================================
# LOAD .ENV
# ============================================================
load_dotenv()
API_KEY = os.getenv("GROQ_API_KEY")
if not API_KEY:
    raise Exception("❌ Missing GROQ_API_KEY in .env")

client = Groq(api_key=API_KEY)


# ============================================================
# READ DOCX AS TEXT
# ============================================================
def read_docx_plain(path: str) -> str:
    doc = Document(path)
    lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(lines)


# ============================================================
# CLEAN JSON FROM LLM
# ============================================================
def clean_llm_json(raw: str) -> str:
    raw = raw.strip().replace("```json", "").replace("```", "")
    m = re.search(r"(\{[\s\S]*\})", raw)
    return m.group(1) if m else raw


# ============================================================
# DETECTION HELPERS
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
# NORMALIZE QUESTIONS
# ============================================================
OPTION_LABELS = ["A", "B", "C", "D"]

def normalize_questions(data: dict) -> dict:
    for q in data.get("questions", []):
        cleaned_opts = []
        for idx, opt in enumerate(q.get("options", [])[:4]):
            o = str(opt).strip()
            o = re.sub(r'^[\(\[\s]*[A-Da-d]\s*[\)\].:-]\s*', "", o).strip()
            cleaned_opts.append(f"{OPTION_LABELS[idx]}. {o}")
        q["options"] = cleaned_opts

        co = str(q.get("correctOption", "")).strip()
        m = re.search(r'([A-Da-d])', co)
        q["correctOption"] = m.group(1).upper() if m else ""

    return data


# ============================================================
# MATH DIAGRAMS
# ============================================================
def inject_math_diagrams(subject: str, data: dict) -> dict:
    if subject.lower() != "mathematics":
        return data

    diagram_map = {
        28: "/uploads/diagrams/mathematics/diagram_28.PNG",
        30: "/uploads/diagrams/mathematics/diagram_30.PNG",
        38: "/uploads/diagrams/mathematics/diagram_38.PNG",
    }

    for q in data.get("questions", []):
        if q.get("id") in diagram_map:
            q["diagram"] = diagram_map[q["id"]]

    return data


# ============================================================
# LLM CALL
# ============================================================
def ask_llm(subject: str, text: str) -> dict:
    prompt = f"""
You are to extract WAEC multiple-choice questions ONLY.

STRICT JSON FORMAT:
{{
  "school": "optional",
  "subject": "{subject}",
  "exam_title": "optional",
  "instructions": "optional",
  "time_allowed_minutes": "optional",
  "questions": [
    {{
      "id": 1,
      "question": "text",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctOption": "A"
    }}
  ]
}}

RULES:
- ALWAYS include `"id"` starting from 1 upward.
- ALWAYS output options EXACTLY as: `"A. text"`, `"B. text"` etc.
- NEVER output Python dicts like {{'a': '1'}} — replace with plain text.
- NEVER include commentary.
- RETURN ONLY PURE JSON.

Extract MCQs from the text below:

{text}
"""

    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    cleaned = clean_llm_json(res.choices[0].message.content)
    return json.loads(cleaned)




def normalize_questions(data: dict) -> dict:
    questions = data.get("questions", [])

    for i, q in enumerate(questions, start=1):
        # add missing id
        if "id" not in q or not isinstance(q["id"], int):
            q["id"] = i

        # Fix options
        cleaned_opts = []
        for idx, opt in enumerate(q.get("options", [])[:4]):
            o = str(opt)

            # Convert "{'a': '220'}" → "220"
            dict_match = re.search(r"'[a-dA-D]':\s*'?(.*?)'?\}", o)
            if dict_match:
                o = dict_match.group(1)

            # Remove leading labels
            o = re.sub(r'^[\(\[\s]*[A-Da-d]\s*[\)\].:-]\s*', "", o).strip()

            cleaned_opts.append(f"{OPTION_LABELS[idx]}. {o}")

        q["options"] = cleaned_opts

        # normalize correctOption
        co = str(q.get("correctOption", "")).strip()
        m = re.search(r'([A-Da-d])', co)
        q["correctOption"] = m.group(1).upper() if m else ""

    return data


# ============================================================
# SAVE FORMAT — CLEAN (NO VERSION)
# ============================================================
def save_output(subject: str, data: dict, class_category: str):
    folder = class_category.upper()
    os.makedirs(f"subjects-json/{folder}", exist_ok=True)

    safe = subject.lower().replace(" ", "_")
    out_path = f"subjects-json/{folder}/{safe}_{class_category.lower()}.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved → {out_path}")
    return out_path


# ============================================================
# MAIN CONVERSION PIPELINE (RETURNS ONLY 3 VALUES)
# ============================================================
def convert_exam(path: str):
    filename = os.path.basename(path)

    subject = detect_subject(filename)
    class_cat = detect_class_category(filename)
    version = detect_version(filename)

    if class_cat == "GENERAL":
        class_cat = class_from_version(version)

    print(f"\n📘 Processing {filename}")
    print(f"   → Subject: {subject}")
    print(f"   → Class:   {class_cat}")

    text = read_docx_plain(path)

    print("🧠 Sending to LLM...")
    data = ask_llm(subject, text)

    print("🔧 Normalizing MCQs...")
    data = normalize_questions(data)

    print("📐 Injecting diagrams...")
    data = inject_math_diagrams(subject, data)

    data["class_category"] = class_cat

    return subject, data, class_cat


# ============================================================
# SAFE-RESUME: DETECT EXISTING JSON FILES
# ============================================================
def get_existing_json_map():
    found = set()

    for root, dirs, files in os.walk("subjects-json"):
        for f in files:
            if not f.endswith(".json"):
                continue
            if f == "pushed_subjects.json":
                continue

            name = f.replace(".json", "")

            try:
                subj, cls = name.rsplit("_", 1)
                found.add((subj.lower(), cls.upper()))
            except:
                pass

    return found


# ============================================================
# SAFE-RESUME PROCESSOR
# ============================================================
def process_all_subjects():
    print("\n=== 🚀 SAFE-RESUME CONVERSION MODE ===\n")

    existing = get_existing_json_map()

    docx_files = sorted([
        f for f in os.listdir("subjects") if f.endswith(".docx")
    ])

    if not docx_files:
        print("❌ No DOCX files found.")
        return

    for filename in docx_files:
        subject = detect_subject(filename)
        safe_subj = subject.lower().replace(" ", "_")

        class_cat = detect_class_category(filename)
        if class_cat == "GENERAL":
            class_cat = class_from_version(detect_version(filename))

        if (safe_subj, class_cat.upper()) in existing:
            print(f"⏭ SKIP (already converted): {filename}")
            continue

        try:
            print(f"\n📘 Converting: {filename}")
            subject, data, class_cat = convert_exam(os.path.join("subjects", filename))
            save_output(subject, data, class_cat)
            print(f"✅ Completed → {filename}")

        except Exception as e:
            print(f"❌ ERROR converting {filename}: {e}")
            print("Stopping conversion to avoid API waste.")
            break

    print("\n🎉 ALL DONE — SAFE-RESUME ACTIVE\n")


# ============================================================
# CLI
# ============================================================
if __name__ == "__main__":
    process_all_subjects()
