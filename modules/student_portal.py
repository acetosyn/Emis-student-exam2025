# modules/student_portal.py

from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify
from modules.student_results import save_result, get_latest_result
from modules.excel_manager import read_results

student_portal_bp = Blueprint('student_portal_bp', __name__)

DEFAULT_SUBJECTS = [
    "BIOLOGY",
    "CHEMISTRY",
    "CIVIC EDUCATION",
    "COMPUTER SCIENCE",
    "ECONOMICS",
    "ENGLISH LANGUAGE",
    "FINANCIAL ACCOUNTING",
    "GEOGRAPHY",
    "GOVERNMENT",
    "LITERATURE-IN-ENGLISH",
    "MATHEMATICS",
    "PHYSICS",
    "TECHNICAL DRAWING"
]


# =======================================================
# Helper — Student login validation
# =======================================================
def get_logged_in_student():
    if session.get('user_type') != 'student':
        return None
    return session.get('student')


# =======================================================
# Student Dashboard
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
# Exam Dashboard (Subject Selected)
# =======================================================
@student_portal_bp.route('/exam_dashboard')
def exam_dashboard():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    subject = request.args.get('subject', '').strip().upper()
    if not subject:
        return redirect(url_for('student_portal_bp.student_portal'))

    class_category = student.get("class_category")
    full_name = student.get("full_name")
    admission_no = student.get("admission_number")

    # Load Excel results safely
    existing_results = read_results(class_category, subject)

    # Safe duplicate detection
    already_written = False
    for r in existing_results:
        name = str(r.get("Student Name", "")).strip().upper()
        adm = str(r.get("Admission No", "")).strip().upper()

        if name == full_name.strip().upper() and adm == admission_no.strip().upper():
            already_written = True
            break

    session['selected_subject'] = subject
    session['exam_submitted'] = already_written

    return render_template(
        'exam_dashboard.html',
        student=student,
        subject=subject,
        already_written=already_written,
        full_name=full_name,
        admission_number=admission_no,
        class_name=student.get("class"),
        class_category=class_category,
        system_id=student.get("id"),
        exam_started=session.get('exam_started', False),
        exam_submitted=session.get('exam_submitted', False)
    )


# =======================================================
# SUBMIT EXAM
# =======================================================
@student_portal_bp.route('/submit_exam', methods=['POST'])
def submit_exam():
    student = get_logged_in_student()
    if not student:
        return jsonify({"error": "Not logged in"}), 401

    exam_data = request.get_json()
    if not exam_data:
        return jsonify({"error": "Invalid data"}), 400

    subject = exam_data.get("subject", "").strip().upper()
    class_category = student.get("class_category")
    full_name = student.get("full_name")
    admission_no = student.get("admission_number")

    # Check duplicate safely
    existing_results = read_results(class_category, subject)

    for r in existing_results:
        name = str(r.get("Student Name", "")).strip().upper()
        adm = str(r.get("Admission No", "")).strip().upper()

        if name == full_name.strip().upper() and adm == admission_no.strip().upper():
            return jsonify({
                "error": "You have already submitted this exam. Contact your teacher/admin."
            }), 403

    # Attach identity
    exam_data.update({
        "student_id": student.get("id"),
        "full_name": full_name,
        "admission_number": admission_no,
        "class_name": student.get("class"),
        "class_category": class_category,
    })

    save_result(exam_data)

    session['exam_submitted'] = True
    session['exam_started'] = False

    return jsonify({"status": "ok", "message": "Exam saved"}), 200


# =======================================================
# Start Exam
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
# Exam Page
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
# Result Page
# =======================================================
@student_portal_bp.route('/result')
def result():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

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



# =======================================================
# BACK TO EXAM DASHBOARD (Safe backend redirect)
# =======================================================
@student_portal_bp.route('/back_to_exam_dashboard')
def back_to_exam_dashboard():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    subject = session.get("selected_subject")
    if not subject:
        return redirect(url_for('student_portal_bp.student_portal'))

    return redirect(url_for('student_portal_bp.exam_dashboard', subject=subject))
