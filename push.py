# push.py — FINAL YEAR-AWARE EMIS PORTAL PUSH SYSTEM (2025)
# ---------------------------------------------------------------
# Handles:
#   ✓ Push subjects into: static/portal/<YEAR>/<CLASS>/pushed_subjects.json
#   ✓ Tracks latest pushed YEAR for students
#   ✓ Students automatically fetch latest pushed year
# ---------------------------------------------------------------

import os
import json
from flask import Blueprint, jsonify, request, session
from pathlib import Path

push_bp = Blueprint("push_bp", __name__)

BASE_DIR = Path(__file__).resolve().parent

# Where converted JSONs live
SUBJECTS_JSON_ROOT = BASE_DIR / "static" / "subjects"

# FINAL PUSH STORAGE
PORTAL_ROOT = BASE_DIR / "static" / "portal"
PORTAL_ROOT.mkdir(parents=True, exist_ok=True)

# WHERE WE STORE THE "LATEST YEAR"
LATEST_YEAR_FILE = PORTAL_ROOT / "latest_year.txt"


# ======================================================================
# Helper: Read latest pushed year
# ======================================================================
def get_latest_year():
    if LATEST_YEAR_FILE.exists():
        return LATEST_YEAR_FILE.read_text().strip()
    return None


# ======================================================================
# Helper: Set latest pushed year
# ======================================================================
def set_latest_year(year: str):
    LATEST_YEAR_FILE.write_text(str(year), encoding="utf-8")


# ======================================================================
# Load pushed list for YEAR + CLASS
# ======================================================================
def load_pushed_list(year: str, class_cat: str):
    path = PORTAL_ROOT / year / class_cat / "pushed_subjects.json"
    if not path.exists():
        return []

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("subjects", [])
    except:
        return []


# ======================================================================
# Save pushed list for YEAR + CLASS
# ======================================================================
def save_pushed_list(year: str, class_cat: str, subjects: list):
    folder = PORTAL_ROOT / year / class_cat
    folder.mkdir(parents=True, exist_ok=True)

    path = folder / "pushed_subjects.json"
    data = {"subjects": subjects}

    path.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")


# ======================================================================
# PUSH SUBJECTS — Called from uploads.js
# ======================================================================
@push_bp.route("/push", methods=["POST"])
def push_subjects():
    payload = request.json

    raw_files = payload.get("files", [])
    target_class = payload.get("class_category")  # SS1 / SS2 / SS3

    if not raw_files:
        return jsonify({"success": False, "error": "No files provided"}), 400

    if target_class not in ["SS1", "SS2", "SS3"]:
        return jsonify({"success": False, "error": "Invalid class"}), 400

    pushed_summary = []
    last_year_used = None

    # Example entry: "2025:chemistry_ss1.json"
    for entry in raw_files:
        try:
            year, filename = entry.split(":", 1)
        except ValueError:
            return jsonify({"success": False, "error": f"Invalid entry: {entry}"}), 400

        year = str(year)
        last_year_used = year  # Track for latest-year update

        # SOURCE FILE
        src = SUBJECTS_JSON_ROOT / year / "subjects-json" / target_class / filename
        if not src.exists():
            print(f"⚠ Missing converted JSON: {src}")
            continue

        try:
            content = json.loads(src.read_text(encoding="utf-8"))
        except:
            continue

        # DESTINATION
        dst_folder = PORTAL_ROOT / year / target_class
        dst_folder.mkdir(parents=True, exist_ok=True)

        dst = dst_folder / filename
        dst.write_text(json.dumps(content, indent=4, ensure_ascii=False), encoding="utf-8")

        # UPDATE pushed list
        pushed_list = load_pushed_list(year, target_class)
        subject_name = filename.replace(".json", "").replace("_", " ").title()

        if subject_name not in pushed_list:
            pushed_list.append(subject_name)

        save_pushed_list(year, target_class, pushed_list)
        pushed_summary.append(subject_name)

    # UPDATE LATEST YEAR
    if last_year_used:
        set_latest_year(last_year_used)

    return jsonify({
        "success": True,
        "class": target_class,
        "subjects_pushed": pushed_summary,
        "latest_year": last_year_used
    })


# ======================================================================
# CLEAR SUBJECTS
# ======================================================================
@push_bp.route("/clear", methods=["POST"])
def clear_portal():
    payload = request.json
    year = str(payload.get("year"))
    target_class = payload.get("class_category")

    if target_class not in ["SS1", "SS2", "SS3", "ALL"]:
        return jsonify({"success": False, "error": "Invalid class"}), 400

    # CLEAR EVERYTHING
    if year == "ALL" and target_class == "ALL":
        for f in PORTAL_ROOT.rglob("*"):
            if f.is_file():
                f.unlink()
        return jsonify({"success": True, "cleared": "ALL"})

    # CLEAR specific CLASS in specific YEAR
    folder = PORTAL_ROOT / year / target_class
    if folder.exists():
        for f in folder.glob("*"):
            f.unlink()

    # leave empty structure
    save_pushed_list(year, target_class, [])

    return jsonify({
        "success": True,
        "cleared": f"{year}-{target_class}"
    })


# ======================================================================
# STUDENT FETCH — Students ALWAYS get latest pushed subjects
# ======================================================================
@push_bp.route("/get_pushed_subjects", methods=["GET"])
def student_get_pushed():
    student = session.get("student")
    if not student:
        return jsonify({"subjects": []})

    class_cat = student.get("class_category")
    if not class_cat:
        return jsonify({"subjects": []})

    # The MAGIC — load last pushed year
    latest_year = get_latest_year()
    if not latest_year:
        return jsonify({"subjects": []})

    pushed_list = load_pushed_list(latest_year, class_cat)

    return jsonify({
        "subjects": [
            {"subject": s, "year": latest_year, "class": class_cat}
            for s in pushed_list
        ]
    })
