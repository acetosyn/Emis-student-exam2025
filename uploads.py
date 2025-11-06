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
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"docx", "txt", "json"}


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def safe_filename(filename: str) -> str:
    return secure_filename(filename)


# ---------------------------------------------------------
# STEP 1 — Convert DOCX → TXT
# ---------------------------------------------------------
def convert_docx_to_txt(docx_path: str) -> str:
    """Extract clean text lines from a .docx and save as .txt."""
    txt_path = os.path.splitext(docx_path)[0] + ".txt"
    try:
        doc = Document(docx_path)
        with open(txt_path, "w", encoding="utf-8") as f:
            for p in doc.paragraphs:
                line = p.text.strip()
                if line:
                    f.write(line + "\n")
        return txt_path
    except Exception as e:
        print(f"⚠️ Error converting DOCX to TXT: {e}")
        return ""


# ---------------------------------------------------------
# STEP 2 — Parse TXT → biology.json-like structure
# ---------------------------------------------------------
def parse_txt_to_json(txt_path: str):
    """Parse TXT file into biology.json structure — tuned for Epiconsult Biology style (colon before A)."""
    try:
        with open(txt_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]

        # ------------------ Metadata ------------------
        school = "EPITOME MODEL ISLAMIC SCHOOLS"
        subject = "Biology"
        exam_title = "BIOLOGY INTERVIEW QUESTIONS"
        instructions = "Attempt all questions from this section"
        time_allowed_minutes = 20
        section = "SECTION A: MCQ"

        questions = []
        q_id = 0

        for line in lines:
            # skip metadata header lines
            if any(word in line.lower() for word in ["school", "instruction", "section", "minute", "biology interview"]):
                continue

            # split question and options
            if "A)" not in line:
                continue

            q_part, opts_part = line.split("A)", 1)
            q_text = q_part.strip().rstrip(":").strip()

            # extract options
            opts = re.findall(r"[A-D]\)\s*([^A-D]+?)(?=\s*[A-D]\)|$)", "A)" + opts_part)
            opts = [opt.strip() for opt in opts if opt.strip()]

            if len(opts) >= 4:
                q_id += 1
                questions.append({
                    "id": q_id,
                    "question": q_text,
                    "options": opts[:4],
                    "answer": ""
                })

        return {
            "school": school,
            "subject": subject,
            "exam_title": exam_title,
            "instructions": instructions,
            "time_allowed_minutes": time_allowed_minutes,
            "section": section,
            "questions": questions
        }

    except Exception as e:
        print(f"⚠️ Error parsing TXT: {e}")
        return {}



# ---------------------------------------------------------
# STEP 3 — Handle Upload
# ---------------------------------------------------------
def handle_upload(request):
    """Handles upload, converts DOCX → TXT → JSON."""
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
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(save_path)

        # If DOCX → convert to TXT
        if filename.lower().endswith(".docx"):
            txt_path = convert_docx_to_txt(save_path)
        elif filename.lower().endswith(".txt"):
            txt_path = save_path
        else:
            txt_path = ""

        if txt_path:
            data = parse_txt_to_json(txt_path)
            json_name = os.path.splitext(filename)[0] + ".json"
            json_path = os.path.join(UPLOAD_FOLDER, json_name)
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            converted.append({
                "source": filename,
                "converted": json_name,
                "count": len(data.get("questions", []))
            })
        else:
            converted.append({
                "source": filename,
                "converted": None,
                "count": 0
            })

    return jsonify({"success": True, "converted": converted})


# ---------------------------------------------------------
# STEP 4 — File management utilities
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
    try:
        with open(path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    except Exception as e:
        print(f"⚠️ Error reading JSON: {e}")
        return jsonify({"error": "Failed to read JSON"}), 500


def delete_converted_file(filename: str):
    path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404
    try:
        os.remove(path)
        return jsonify({"success": True, "deleted": filename})
    except Exception as e:
        print(f"⚠️ Error deleting file: {e}")
        return jsonify({"error": "Failed to delete file"}), 500
