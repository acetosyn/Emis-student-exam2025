# ============================================================
#   NEW API ROUTES — EMIS EXCEL RESULT ENGINE (2025)
# ============================================================

from flask import Blueprint, jsonify, request, session
from modules.excel_manager import read_results, get_excel_path
from pathlib import Path

api_bp = Blueprint("api_bp", __name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CLASS_DIR = BASE_DIR / "CLASS"


# ============================================================
#   Helper: Check Access (Admin + Teacher)
# ============================================================
def can_view_results():
    return session.get("user_type") in ["admin", "teacher"]


# ============================================================
#   1️⃣ List Class Categories (SS1, SS2, SS3)
# ============================================================
@api_bp.route("/api/results/classes")
def get_class_categories():
    if not can_view_results():
        return jsonify({"error": "Unauthorized"}), 403

    if not CLASS_DIR.exists():
        return jsonify({"classes": []})

    classes = [folder.name for folder in CLASS_DIR.iterdir() if folder.is_dir()]
    return jsonify({"classes": sorted(classes)})


# ============================================================
#   2️⃣ List Subjects Available Inside a Class Folder
# ============================================================
@api_bp.route("/api/results/subjects")
def get_subjects_for_class():
    if not can_view_results():
        return jsonify({"error": "Unauthorized"}), 403

    class_category = request.args.get("class", "").upper().strip()
    class_folder = CLASS_DIR / class_category

    if not class_folder.exists():
        return jsonify({"subjects": []})

    subjects = [
        folder.name for folder in class_folder.iterdir() if folder.is_dir()
    ]

    return jsonify({"subjects": sorted(subjects)})


# ============================================================
#   3️⃣ LOAD EXCEL RESULTS (Class + Subject)
# ============================================================
@api_bp.route("/api/results/load")
def load_excel_results():
    if not can_view_results():
        return jsonify({"error": "Unauthorized"}), 403

    class_category = request.args.get("class", "").strip().upper()
    subject = request.args.get("subject", "").strip()

    if not class_category or not subject:
        return jsonify({"error": "Missing class or subject"}), 400

    try:
        results = read_results(class_category, subject)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e), "results": []})


# ============================================================
#   4️⃣ FILE CHECKER — Does result.xlsx exist?
# ============================================================
@api_bp.route("/api/results/exists")
def excel_exists():
    if not can_view_results():
        return jsonify({"error": "Unauthorized"}), 403

    class_cat = request.args.get("class", "").strip().upper()
    subject = request.args.get("subject", "").strip()

    excel_path = get_excel_path(class_cat, subject)

    return jsonify({
        "exists": excel_path.exists(),
        "path": str(excel_path)
    })
