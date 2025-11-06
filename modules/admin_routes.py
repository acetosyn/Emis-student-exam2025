# modules/admin_routes.py
from flask import Blueprint, request, session, redirect, url_for, jsonify, render_template
from engine import generate_teacher_ids, get_all_teachers, validate_teacher_login
from pathlib import Path
import csv
from datetime import datetime
import user_credentials
import user_exam

admin_bp = Blueprint('admin_bp', __name__)

BASE_DIR = Path(__file__).resolve().parent.parent
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)


# -------------------- UNIFIED ADMIN / TEACHER LOGIN --------------------
@admin_bp.route('/admin_login', methods=['GET', 'POST'])
def admin_login():
    from app import ADMIN_USERNAME, ADMIN_PASSWORD  # load env credentials

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        # 1️⃣ Check for ADMIN credentials first
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session.clear()
            session['user_type'] = 'admin'
            session['username'] = username
            return redirect(url_for('admin_bp.admin_dashboard'))

        # 2️⃣ If not admin, check for TEACHER credentials from DB
        if validate_teacher_login(username, password):
            session.clear()
            session['user_type'] = 'teacher'
            session['teacher_id'] = username
            return redirect(url_for('admin_bp.admin_dashboard'))

        # 3️⃣ If neither admin nor teacher match
        return render_template('admin_login.html', error="❌ Invalid Username or Password")

    return render_template('admin_login.html')



# -------------------- GENERATE TEACHER IDS (AJAX) --------------------
@admin_bp.route("/generate_teacher_ids", methods=["GET", "POST"])
def generate_teacher_ids_api():
    if session.get("user_type") != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    try:
        if request.method == "POST":
            num = int(request.form.get("count", 1))
            if num < 1 or num > 100:
                return jsonify({"error": "Invalid count"}), 400

            generated = generate_teacher_ids(count=num)
            all_teachers = get_all_teachers()
            return jsonify({
                "message": f"{len(generated)} Teacher IDs generated successfully.",
                "generated": generated,
                "teachers": all_teachers
            })

        # GET request → fetch all existing teacher IDs
        return jsonify({"teachers": get_all_teachers()})
    except Exception as e:
        print("⚠️ Error generating IDs:", e)
        return jsonify({"error": str(e)}), 500




# -------------------- ADMIN DASHBOARD + SUBPAGES --------------------
@admin_bp.route('/admin')
@admin_bp.route('/admin/dashboard')
def admin_dashboard():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('dashboard.html')


@admin_bp.route('/admin/teachers')
def admin_teachers():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('teachers.html')


@admin_bp.route('/admin/students')
def admin_students():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('students.html')


@admin_bp.route('/admin/ids')
def admin_ids():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('ids.html')


@admin_bp.route('/admin/past_questions')
def admin_past_questions():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('past_questions.html')


@admin_bp.route('/admin/mock_exam')
def admin_mock_exam():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('mock_exam.html')


@admin_bp.route('/admin/results')
def admin_results():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('result.html')


@admin_bp.route('/admin/third_party')
def admin_third_party():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('third_party.html')


@admin_bp.route('/admin/activities')
def admin_activities():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('activities.html')


@admin_bp.route('/admin/settings')
def admin_settings():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('settings.html')


@admin_bp.route('/admin/support')
def admin_support():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('support.html')


# @admin_bp.route('/admin/uploads')
# def admin_uploads():
#     if session.get('user_type') != 'admin':
#         return redirect(url_for('admin_bp.admin_login'))
#     return render_template('uploads.html')


@admin_bp.route('/admin/dash_results')
def admin_dash_results():
    if session.get('user_type') != 'admin':
        return redirect(url_for('admin_bp.admin_login'))
    return render_template('dash_results.html')


# -------------------- VIEW / CLEAR RESULTS + CREDENTIALS --------------------
@admin_bp.route("/view_credentials")
def view_credentials():
    files = sorted(LOGS_DIR.glob("credentials_*.csv"), reverse=True)
    if not files:
        return jsonify({"credentials": []})
    latest = files[0]
    creds = []
    try:
        with open(latest, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                creds.append({
                    "username": row.get("username", "").strip(),
                    "password": row.get("password", "").strip()
                })
    except Exception as e:
        print(f"⚠️ Error reading credentials file: {e}")
    return jsonify({"credentials": creds})


@admin_bp.route("/view_results")
def view_results():
    if session.get('user_type') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    results = []
    try:
        results = user_exam.get_exam_results() or []
    except Exception as e:
        print(f"⚠️ DB fetch failed: {e}")

    if not results:
        files = sorted(LOGS_DIR.glob("exam_results_*.csv"), reverse=True)
        for file in files:
            try:
                with open(file, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        cleaned = {k.strip(): (v or "").strip() for k, v in row.items()}
                        results.append(cleaned)
            except Exception as e:
                print(f"⚠️ Error reading {file.name}: {e}")

    results.sort(key=lambda r: r.get("submitted_at", ""), reverse=True)
    return jsonify({"results": results})
