# uploads.py — CLEAN VERSION (Upload + Convert Only)
import os
import json
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from convert import convert_exam, save_output, detect_version, detect_subject

# ---------------------------------------------------------
# BLUEPRINT
# ---------------------------------------------------------
uploads_bp = Blueprint("uploads_bp", __name__)

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

SUBJECTS_JSON_FOLDER = os.path.join(BASE_DIR, "subjects-json")
os.makedirs(SUBJECTS_JSON_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"docx", "json"}


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def safe_filename(filename: str) -> str:
    return secure_filename(filename)


def detect_class_category(filename: str) -> str:
    """Detect SS1/SS2/SS3 from filename."""
    name = filename.lower()
    if "ss1" in name: return "SS1"
    if "ss2" in name: return "SS2"
    if "ss3" in name: return "SS3"
    return "GENERAL"


# ---------------------------------------------------------
# UPLOAD + CONVERT (DOCX → JSON)
# ---------------------------------------------------------
def handle_upload(request):
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "No selected files"}), 400

    overwrite_requested = request.form.get("overwrite") == "true"
    converted = []

    for file in files:
        if not allowed_file(file.filename):
            continue

        filename = safe_filename(file.filename)
        ext = filename.split(".")[-1].lower()

        # Save temporarily
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(save_path)

        subject = detect_subject(filename)
        class_cat = detect_class_category(filename)
        version = detect_version(filename)

        # Prepare JSON output folder
        folder = class_cat.upper()
        os.makedirs(os.path.join(SUBJECTS_JSON_FOLDER, folder), exist_ok=True)

        json_filename = f"{subject.lower().replace(' ', '_')}_{class_cat.lower()}.json"
        json_path = os.path.join(SUBJECTS_JSON_FOLDER, folder, json_filename)

        # Already exists?
        if os.path.exists(json_path) and not overwrite_requested:
            converted.append({
                "source": filename,
                "status": "exists",
                "json_filename": json_filename,
                "subject": subject,
                "class_category": class_cat
            })
            continue

        # DOCX → Convert
        if ext == "docx":
            try:
                subject, data, final_class = convert_exam(save_path)
                json_path = save_output(subject, data, final_class)

                converted.append({
                    "source": filename,
                    "status": "overwritten" if overwrite_requested else "converted",
                    "subject": subject,
                    "class_category": final_class,
                    "json_filename": json_filename,
                    "json_path": json_path,
                    "question_count": len(data.get("questions", [])),
                })

            except Exception as e:
                print("⚠️ Conversion error:", e)
                converted.append({"source": filename, "error": "conversion_failed"})

        # JSON upload
        elif ext == "json":
            try:
                file.stream.seek(0)
                payload = json.load(file.stream)
                subject = payload.get("subject") or subject
                final_class = class_cat

                json_path = save_output(subject, payload, final_class)

                converted.append({
                    "source": filename,
                    "status": "overwritten" if overwrite_requested else "saved",
                    "subject": subject,
                    "class_category": final_class,
                    "json_filename": json_filename,
                    "json_path": json_path,
                    "question_count": len(payload.get("questions", [])),
                })

            except Exception:
                converted.append({"source": filename, "error": "invalid_json"})

    return jsonify({"success": True, "converted": converted})


# ---------------------------------------------------------
# LIST JSON FILES
# ---------------------------------------------------------
def list_converted_files():
    result = []

    for class_cat in ["SS1", "SS2", "SS3", "GENERAL"]:
        folder = os.path.join(SUBJECTS_JSON_FOLDER, class_cat)
        if not os.path.isdir(folder):
            continue

        for f in sorted(os.listdir(folder)):
            if not f.endswith(".json"):
                continue

            full = os.path.join(folder, f)
            size_kb = round(os.path.getsize(full) / 1024, 1)

            subject = detect_subject(f)
            version = detect_version(f)
            q_count = 0

            try:
                with open(full, "r", encoding="utf-8") as jf:
                    data = json.load(jf)
                    subject = data.get("subject", subject)
                    q_count = len(data.get("questions", []))
            except:
                pass

            result.append({
                "filename": f,
                "subject": subject,
                "class_category": class_cat,
                "version": version,
                "questions": q_count,
                "size_kb": size_kb,
                "path": full,
                "last_modified": os.path.getmtime(full)
            })

    return result


def list_subject_jsons():
    return list_converted_files()


# ---------------------------------------------------------
# PREVIEW JSON
# ---------------------------------------------------------
def get_converted_json(filename: str):
    for class_cat in ["SS1", "SS2", "SS3", "GENERAL"]:
        path = os.path.join(SUBJECTS_JSON_FOLDER, class_cat, filename)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return jsonify(json.load(f))
            except:
                return jsonify({"error": "Failed to read JSON"}), 500

    return jsonify({"error": "File not found"}), 404


# ---------------------------------------------------------
# DELETE JSON
# ---------------------------------------------------------
def delete_converted_file(filename: str):
    for class_cat in ["SS1", "SS2", "SS3", "GENERAL"]:
        path = os.path.join(SUBJECTS_JSON_FOLDER, class_cat, filename)
        if os.path.exists(path):
            try:
                os.remove(path)
                return jsonify({"success": True, "deleted": filename})
            except:
                return jsonify({"error": "Failed to delete file"}), 500

    return jsonify({"error": "File not found"}), 404
