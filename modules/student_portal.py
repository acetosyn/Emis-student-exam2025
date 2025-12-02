# modules/student_portal.py

from flask import Blueprint, render_template, redirect, url_for, session, request
from modules.student_results import save_result
from flask import jsonify
from modules.student_results import get_latest_result

student_portal_bp = Blueprint('student_portal_bp', __name__)

DEFAULT_SUBJECTS = [
    "BIOLOGY", "CHEMISTRY", "COMPUTER STUDIES", "ECONOMICS", "ENGLISH LANGUAGE",
    "GEOGRAPHY", "GOVERNMENT", "MATHEMATICS", "PHYSICS", "TECHNICAL DRAWING",
    "FINANCIAL ACCOUNTING", "LITERATURE-IN-ENGLISH"
]


# =======================================================
#  HELPER — ENSURE STUDENT IS LOGGED IN
# =======================================================
def get_logged_in_student():
    """Returns student dict from session or None."""
    if session.get('user_type') != 'student':
        return None
    return session.get('student')


# =======================================================
#  MAIN STUDENT DASHBOARD
# =======================================================
@student_portal_bp.route('/student_portal')
def student_portal():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    return render_template(
        'students.html',
        student=student,
        subjects=DEFAULT_SUBJECTS,
        exam_started=session.get('exam_started', False),
        exam_submitted=session.get('exam_submitted', False)
    )


# =======================================================
#  EXAM DASHBOARD (Select → Instructions → Start Exam)
# =======================================================
@student_portal_bp.route('/exam_dashboard')
def exam_dashboard():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    # FIX: ensure subject casing is uniform
    subject = request.args.get('subject', '').strip().upper()

    if not subject:
        return redirect(url_for('student_portal_bp.student_portal'))

    # Save selected subject to session
    session['selected_subject'] = subject

    return render_template(
        'exam_dashboard.html',

        # full student object
        student=student,
        subject=subject,

        # pass individual fields (optional but useful)
        full_name=student.get("full_name"),
        admission_number=student.get("admission_number"),
        class_name=student.get("class"),
        class_category=student.get("class_category"),
        system_id=student.get("id"),

        exam_started=session.get('exam_started', False),
        exam_submitted=session.get('exam_submitted', False)
    )


# =======================================================
#  START EXAM (POST)
# =======================================================
@student_portal_bp.route('/start_exam', methods=['POST'])
def start_exam():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    if session.get('exam_submitted'):
        return redirect(url_for('student_portal_bp.result'))

    session['exam_started'] = True
    return redirect(url_for('student_portal_bp.exam'))


# =======================================================
#  EXAM PAGE — exam.html
# =======================================================
@student_portal_bp.route('/exam')
def exam():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    subject = session.get('selected_subject')

    if not subject:
        return redirect(url_for('student_portal_bp.student_portal'))

    return render_template(
        'exam.html',
        student=student,
        subject=subject,
        exam_started=session.get('exam_started', False)
    )


# =======================================================
#  SUBMIT EXAM  (NEW MODERN VERSION)
# =======================================================


@student_portal_bp.route('/submit_exam', methods=['POST'])
def submit_exam():
    student = get_logged_in_student()
    if not student:
        return jsonify({"error": "Not logged in"}), 401

    # Incoming exam data from result.js
    exam_data = request.get_json()

    if not exam_data:
        return jsonify({"error": "Invalid data"}), 400

    # Attach student identity to the result
    exam_data.update({
        "student_id": student.get("id"),
        "full_name": student.get("full_name"),
        "admission_number": student.get("admission_number"),
        "class_name": student.get("class"),
        "class_category": student.get("class_category"),
    })

    # Save to database
    save_result(exam_data)

    # Update session state
    session['exam_submitted'] = True
    session['exam_started'] = False

    return jsonify({"status": "ok", "message": "Exam saved"}), 200



@student_portal_bp.route('/result')
def result():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    # LOAD REAL DATA
    latest_result = get_latest_result(student.get("id"))

    if not latest_result:
        latest_result = {
            "score": 0,
            "correct": 0,
            "incorrect": 0,
            "total": 0,
            "answered": 0,
            "skipped": 0,
            "flagged": 0,
            "tabSwitches": 0,
            "time_taken": 0,
            "subject": session.get("selected_subject", "Unknown"),
            "submitted_at": None,
            "status": "No exam record yet"
        }

    return render_template("result.html", student=student, result=latest_result)
