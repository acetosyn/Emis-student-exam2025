# push.py — All Portal Push Logic (FINAL 2025 FIXED VERSION)
import os
import json
from flask import Blueprint, jsonify, request, session

push_bp = Blueprint("push_bp", __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SUBJECTS_JSON_FOLDER = os.path.join(BASE_DIR, "subjects-json")

# Folder where pushed subjects are stored per class
PORTAL_ROOT = os.path.join(BASE_DIR, "exam-portal")
os.makedirs(PORTAL_ROOT, exist_ok=True)

PUSHED_FILE = os.path.join(PORTAL_ROOT, "pushed_subjects.json")


# ======================================================
# LOAD + SAVE PUSH DATA
# ======================================================
def load_pushed_data():
    if os.path.exists(PUSHED_FILE):
        with open(PUSHED_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"SS1": [], "SS2": [], "SS3": []}


def save_pushed_data(data):
    with open(PUSHED_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


# ======================================================
# PUSH SUBJECTS TO CLASS FOLDER (SS1 / SS2 / SS3)
# ======================================================
@push_bp.route("/push", methods=["POST"])
def push_subjects():
    payload = request.json
    filenames = payload.get("files", [])
    target_class = payload.get("class_category")

    if not filenames:
        return jsonify({"success": False, "error": "No files provided"}), 400
    if target_class not in ["SS1", "SS2", "SS3"]:
        return jsonify({"success": False, "error": "Invalid class"}), 400

    pushed = load_pushed_data()

    class_folder = os.path.join(PORTAL_ROOT, target_class)
    os.makedirs(class_folder, exist_ok=True)

    copied_files = []

    for fname in filenames:
        found = False

        # search in SS1, SS2, SS3, GENERAL
        for ccat in ["SS1", "SS2", "SS3", "GENERAL"]:
            src = os.path.join(SUBJECTS_JSON_FOLDER, ccat, fname)

            if os.path.exists(src):
                found = True
                dst = os.path.join(class_folder, fname)

                # FIX: always UTF-8
                with open(src, "r", encoding="utf-8") as s:
                    data = json.load(s)

                with open(dst, "w", encoding="utf-8") as d:
                    json.dump(data, d, indent=4, ensure_ascii=False)

                if fname not in pushed[target_class]:
                    pushed[target_class].append(fname)

                copied_files.append(fname)
                break

        if not found:
            print(f"⚠️ WARNING: {fname} not found in subjects-json folders.")

    save_pushed_data(pushed)

    return jsonify({
        "success": True,
        "class": target_class,
        "files_pushed": copied_files,
        "current_pushed": pushed[target_class]
    })


# ======================================================
# CLEAR SUBJECTS
# ======================================================
@push_bp.route("/clear", methods=["POST"])
def clear_portal():
    target = request.json.get("class_category")
    pushed = load_pushed_data()

    if target == "ALL":
        for c in ["SS1", "SS2", "SS3"]:
            folder = os.path.join(PORTAL_ROOT, c)
            if os.path.isdir(folder):
                for f in os.listdir(folder):
                    os.remove(os.path.join(folder, f))
            pushed[c] = []
    else:
        if target not in ["SS1", "SS2", "SS3"]:
            return jsonify({"success": False, "error": "Invalid class"}), 400

        folder = os.path.join(PORTAL_ROOT, target)
        if os.path.isdir(folder):
            for f in os.listdir(folder):
                os.remove(os.path.join(folder, f))

        pushed[target] = []

    save_pushed_data(pushed)
    return jsonify({"success": True, "cleared": target, "pushed": pushed})


# ======================================================
# STUDENT PORTAL FETCHES SUBJECTS HERE
# ======================================================
@push_bp.route("/get_pushed_subjects", methods=["GET"])
def student_get_pushed():
    student = session.get("student")
    if not student:
        return jsonify({"subjects": []})

    student_class = student.get("class_category")
    if not student_class:
        return jsonify({"subjects": []})

    data = load_pushed_data()
    subjects = data.get(student_class, [])

    clean = [s.replace(".json", "").replace("_", " ").title() for s in subjects]

    return jsonify({"subjects": clean})
