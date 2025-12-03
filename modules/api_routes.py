# ============================================================
#   NEW API ROUTES — EMIS EXCEL RESULT ENGINE (2025) — FIXED
#   ✔ Case-insensitive subject handling
#   ✔ Fixed folder mismatch blocking results
#   ✔ Admin result loading restored
# ============================================================

from flask import Blueprint, jsonify, request, session
from pathlib import Path
from modules.excel_manager import read_results, get_excel_path

api_bp = Blueprint("api_bp", __name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CLASS_DIR = BASE_DIR / "CLASS"


# ============================================================
#   Helper: Check Access (Admin + Teacher)
# ============================================================
def can_view_results():
    user = session.get("user_type")
    if user is None:
        # Some browsers block cookies, so fallback
        return False
    return user.lower() in ["admin", "teacher"]



# ============================================================
#   1️⃣ Get Class Categories (SS1, SS2, SS3)
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
#   2️⃣ Get Subjects Inside Selected Class Folder
# ============================================================
@api_bp.route("/api/results/subjects")
def get_subjects_for_class():
    if not can_view_results():
        return jsonify({"error": "Unauthorized"}), 403

    class_category = request.args.get("class", "").strip().upper()
    class_folder = CLASS_DIR / class_category

    if not class_folder.exists():
        return jsonify({"subjects": []})

    # Normalize subjects to uppercase for dropdown
    subjects = [folder.name.upper() for folder in class_folder.iterdir() if folder.is_dir()]
    subjects.sort()

    return jsonify({"subjects": subjects})


# ============================================================
#   INTERNAL: Resolve correct folder for subject
#   (Case-insensitive matching)
# ============================================================
def resolve_subject_folder(class_category, subject):
    """
    Allows:
        "CHEMISTRY" → "Chemistry"
        "chemistry" → "Chemistry"
        "Chemistry" → "Chemistry"
    """

    class_folder = CLASS_DIR / class_category
    if not class_folder.exists():
        return None

    target = subject.lower().strip()

    for folder in class_folder.iterdir():
        if folder.is_dir() and folder.name.lower() == target:
            return folder.name   # Return actual proper-case name

    return None


# ============================================================
#   3️⃣ LOAD EXCEL RESULTS (Class + Subject)
# ============================================================
@api_bp.route("/api/results/load")
def load_excel_results():
    if not can_view_results():
        return jsonify({"error": "Unauthorized"}), 403

    class_category = request.args.get("class", "").strip().upper()
    subject_raw = request.args.get("subject", "").strip()

    if not class_category or not subject_raw:
        return jsonify({"error": "Missing class or subject"}), 400

    # Match folder exactly irrespective of case
    subject = resolve_subject_folder(class_category, subject_raw)
    if not subject:
        return jsonify({"results": [], "error": "Subject folder not found"}), 200

    try:
        results = read_results(class_category, subject)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e), "results": []})


# ============================================================
#   4️⃣ FILE CHECK — Does results.xlsx exist?
# ============================================================
@api_bp.route("/api/results/exists")
def excel_exists():
    if not can_view_results():
        return jsonify({"error": "Unauthorized"}), 403

    class_cat = request.args.get("class", "").strip().upper()
    subject_raw = request.args.get("subject", "").strip()

    subject = resolve_subject_folder(class_cat, subject_raw)
    if not subject:
        return jsonify({"exists": False})

    excel_path = get_excel_path(class_cat, subject)

    return jsonify({
        "exists": excel_path.exists(),
        "path": str(excel_path)
    })


# ============================================================
#   5️⃣ MAIN ADMIN RESULTS LOADER (NEW)
# ============================================================
@api_bp.route("/api/results")
def api_get_results():
    class_cat = request.args.get("class", "").strip().upper()
    subject_raw = request.args.get("subject", "").strip()

    if not class_cat or not subject_raw:
        return jsonify({"error": "Missing parameters", "results": []}), 400

    # Resolve folder
    subject = resolve_subject_folder(class_cat, subject_raw)
    if not subject:
        return jsonify({"results": []}), 200

    try:
        records = read_results(class_cat, subject)

        if not records:
            return jsonify({"results": []}), 200

        # Clean up None values
        clean_records = []
        for row in records:
            clean_row = {k: (v if v is not None else "") for k, v in row.items()}
            clean_records.append(clean_row)

        return jsonify({"results": clean_records}), 200

    except Exception as e:
        print("❌ ERROR reading results:", e)
        return jsonify({"error": "Failed to read results", "results": []}), 500


# ============================================================
#   6️⃣ DELETE SELECTED RESULTS (Case-insensitive match)
# ============================================================
@api_bp.route("/api/results/delete", methods=["POST"])
def delete_excel_results():
    if not can_view_results():
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()

    class_cat = data.get("class_category", "").strip().upper()
    subject_raw = data.get("subject", "").strip()

    delete_list = data.get("delete_items", [])

    if not class_cat or not subject_raw:
        return jsonify({"error": "Missing parameters"}), 400

    if not delete_list:
        return jsonify({"error": "No items to delete"}), 400

    # Resolve correct subject folder name
    subject = resolve_subject_folder(class_cat, subject_raw)
    if not subject:
        return jsonify({"error": "Subject not found"}), 404

    excel_path = get_excel_path(class_cat, subject)

    if not excel_path.exists():
        return jsonify({"error": "Result file does not exist"}), 404

    # Load results
    results = read_results(class_cat, subject)

    # Normalize delete targets
    delete_targets = set(
        (item["Student Name"].strip().upper(), item["Admission No"].strip().upper())
        for item in delete_list
    )

    # Filter
    updated = []
    for r in results:
        key = (
            str(r.get("Student Name", "")).strip().upper(),
            str(r.get("Admission No", "")).strip().upper()
        )
        if key not in delete_targets:
            updated.append(r)

    # Save back
    import pandas as pd
    df = pd.DataFrame(updated)
    df.to_excel(excel_path, index=False)

    return jsonify({"status": "ok", "message": "Records deleted successfully"})
