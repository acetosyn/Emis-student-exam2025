import os
import re
import json
from docx import Document
from uploads import convert_docx_to_txt  # reuse the helper

# ----------------------------------------------------------
# CONFIG
# ----------------------------------------------------------
SOURCE_DOCX = "BIOLOGY_QUESTIONS.docx"
WORK_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_PATH = os.path.join(WORK_DIR, SOURCE_DOCX)
TXT_PATH = os.path.splitext(SOURCE_PATH)[0] + "_formatted.txt"
JSON_PATH = os.path.splitext(SOURCE_PATH)[0] + "_formatted.json"


# ----------------------------------------------------------
# STEP 1: CLEAN & NORMALIZE DOCX INTO PLAIN TEXT
# ----------------------------------------------------------
def format_docx_to_clean_txt(docx_path, txt_path):
    """
    Reads the DOCX, flattens it, and then adds line breaks before each numbered question (1., 2., 3. etc.)
    so each question is on its own line.
    """
    doc = Document(docx_path)
    text = " ".join([p.text.strip() for p in doc.paragraphs if p.text.strip()])
    text = re.sub(r"\s+", " ", text).strip()

    # ✅ Insert newlines before question numbers (e.g., "1. ", "2. ")
    text = re.sub(r"(?<=\d\.)\s+", "\n", text)

    # ✅ Optional: also handle if numbering uses “1)” instead of “1.”
    text = re.sub(r"(?<=\d\))\s+", "\n", text)

    # ✅ Clean stray headers
    text = re.sub(r"EPITOME MODEL ISLAMIC SCHOOLS.*?SECTION A: MCQ", "", text, flags=re.I)

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(text.strip())

    print(f"✅ Cleaned & structured TXT saved → {txt_path}")
    return txt_path



# ----------------------------------------------------------
# STEP 2: PARSE CLEAN TXT INTO STRUCTURED JSON
# ----------------------------------------------------------
def parse_formatted_txt(txt_path):
    """Extracts numbered questions with options A–D."""
    with open(txt_path, "r", encoding="utf-8") as f:
        text = f.read().strip()

    # Regex matches exactly this pattern:
    # 1. Question ... A. opt1 B. opt2 C. opt3 D. opt4
    pattern = re.compile(
        r"\d+\.\s*(.*?)\s*A[\.\)]\s*(.*?)\s*B[\.\)]\s*(.*?)\s*C[\.\)]\s*(.*?)\s*D[\.\)]\s*(?:(.*?)(?=\d+\.|$))",
        re.DOTALL
    )

    matches = pattern.findall(text)
    questions = []

    for i, m in enumerate(matches, 1):
        q_text = m[0].strip().rstrip(":").strip()
        opts = [opt.strip().rstrip(".") for opt in m[1:5] if opt.strip()]
        if len(opts) >= 4:
            questions.append({
                "id": i,
                "question": q_text,
                "options": opts[:4],
                "answer": ""
            })

    exam = {
        "school": "EPITOME MODEL ISLAMIC SCHOOLS",
        "subject": "Biology",
        "exam_title": "BIOLOGY INTERVIEW QUESTIONS",
        "instructions": "Attempt all questions from this section",
        "time_allowed_minutes": 20,
        "section": "SECTION A: MCQ",
        "questions": questions
    }

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(exam, f, indent=2, ensure_ascii=False)

    print(f"✅ JSON with {len(questions)} questions saved → {JSON_PATH}")
    return exam


# ----------------------------------------------------------
# STEP 3: RUN TEST
# ----------------------------------------------------------
if __name__ == "__main__":
    if not os.path.exists(SOURCE_PATH):
        print(f"❌ Missing {SOURCE_DOCX} in {WORK_DIR}")
    else:
        txt_path = format_docx_to_clean_txt(SOURCE_PATH, TXT_PATH)
        result = parse_formatted_txt(txt_path)

        print("\n📄 Sample Output Preview (first 3):")
        for q in result["questions"][:3]:
            print(f"\n{q['id']}. {q['question']}")
            for opt in q["options"]:
                print(f"   - {opt}")
