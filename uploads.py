# uploads.py
import os
import json
import re
from flask import jsonify
from werkzeug.utils import secure_filename
from docx import Document

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"docx", "json", "csv", "xlsx"}


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def safe_filename(filename: str) -> str:
    return secure_filename(filename)


# ---------------------------------------------------------
# CLEAN & STANDARDIZE RAW DOCX (optional pre-cleaner)
# ---------------------------------------------------------
def doc_conversion(raw_path: str) -> str:
    """Normalizes the DOCX layout (numbering, options)."""
    try:
        doc = Document(raw_path)
        cleaned = Document()

        lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        text = "\n".join(lines)

        # Normalize numbering and options
        text = re.sub(r"(?<!\d)(\d+)[\)\-]", r"\1.", text)
        text = re.sub(r"([A-D])[\.\-]\s*", r"\1) ", text)

        for block in text.split("\n"):
            if block.strip():
                cleaned.add_paragraph(block.strip())

        temp_path = os.path.splitext(raw_path)[0] + "_temp.docx"
        cleaned.save(temp_path)
        return temp_path
    except Exception as e:
        print(f"⚠️ Error in doc_conversion: {e}")
        return raw_path


# ---------------------------------------------------------
# PARSER — PRODUCE STRUCTURE LIKE biology.json
# ---------------------------------------------------------
def parse_docx_questions(filepath: str):
    """
    Converts DOCX to structured JSON identical to biology.json format.
    """
    try:
        doc = Document(filepath)
        lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        full_text = "\n".join(lines)

        # ------------------ METADATA ------------------
        school = next((l for l in lines if re.search(r"SCHOOL", l, re.I)), "")
        subject = next((l for l in lines if re.search(
            r"BIOLOGY|PHYSICS|CHEMISTRY|ENGLISH|MATHEMATICS|CIVIC|ECONOMICS|ACCOUNT|COMPUTER", l, re.I)), "")
        exam_title = next((l for l in lines if re.search(r"INTERVIEW|EXAM|TEST|QUESTION", l, re.I)), "")
        instructions = next((l for l in lines if re.search(r"Instruction", l, re.I)), "")
        time_line = next((l for l in lines if re.search(r"time", l, re.I)), "")
        section = next((l for l in lines if re.search(r"section", l, re.I)), "")

        match_time = re.search(r"(\d+)\s*minute", time_line, re.I)
        time_allowed_minutes = int(match_time.group(1)) if match_time else 60

        # ------------------ QUESTIONS ------------------
        q_blocks = re.split(r"(?=\b\d+\s*\.)", full_text)
        questions = []
        q_id = 0

        for block in q_blocks:
            block = block.strip()
            if not block or not re.match(r"^\d+\s*\.", block):
                continue

            # Extract question
            q_id += 1
            q_text_match = re.match(r"^\d+\.\s*(.*)", block, re.S)
            q_text = q_text_match.group(1).strip() if q_text_match else block

            # Extract options
            opts = re.findall(r"[A-D]\)\s*(.+)", block)
            opts = [o.strip() for o in opts if o.strip()]
            q_text = re.sub(r"[A-D]\)\s*.+", "", q_text).strip()

            # Try to guess correct answer if formatted like “A) correct”
            answer = opts[0] if opts else ""

            if len(opts) >= 4:
                questions.append({
                    "id": q_id,
                    "question": q_text,
                    "options": opts[:4],
                    "answer": answer
                })

        # ------------------ RETURN ------------------
        return {
            "school": school or "",
            "subject": subject.title() if subject else "",
            "exam_title": exam_title or "",
            "instructions": re.sub(r"(?i)instruction[:\-]?", "", instructions).strip(),
            "time_allowed_minutes": time_allowed_minutes,
            "section": section or "",
            "questions": questions
        }

    except Exception as e:
        print(f"⚠️ Error parsing DOCX file: {filepath} — {e}")
        return {}


# ---------------------------------------------------------
# UPLOAD HANDLER
# ---------------------------------------------------------
def handle_upload(request):
    """Handles upload and conversion."""
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "No selected files"}), 400

    converted = []

    for file in files:
        if not allowed_file(file.filename):
            continue

        filename = safe_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)

        if filename.lower().endswith(".docx"):
            cleaned_path = doc_conversion(file_path)
            exam_data = parse_docx_questions(cleaned_path)

            json_name = os.path.splitext(filename)[0] + ".json"
            json_path = os.path.join(UPLOAD_FOLDER, json_name)

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(exam_data, f, indent=2, ensure_ascii=False)

            converted.append({
                "source": filename,
                "converted": json_name,
                "count": len(exam_data.get("questions", []))
            })

        else:
            converted.append({
                "source": filename,
                "converted": None,
                "count": 0
            })

    return jsonify({"success": True, "converted": converted})


# ---------------------------------------------------------
# LIST / VIEW / DELETE
# ---------------------------------------------------------
def list_converted_files():
    files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith(".json")]
    return [
        {
            "filename": f,
            "path": os.path.join(UPLOAD_FOLDER, f),
            "size_kb": round(os.path.getsize(os.path.join(UPLOAD_FOLDER, f)) / 1024, 1)
        }
        for f in sorted(files)
    ]


def get_converted_json(filename: str):
    path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


def delete_converted_file(filename: str):
    path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404
    os.remove(path)
    return jsonify({"success": True, "deleted": filename})
