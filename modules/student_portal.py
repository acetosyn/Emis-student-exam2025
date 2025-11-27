# modules/student_portal.py

from flask import Blueprint, render_template, redirect, url_for, session, request

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

    subject = request.args.get('subject', '').strip()
    if not subject:
        return redirect(url_for('student_portal_bp.student_portal'))

    # Save the selected subject
    session['selected_subject'] = subject

    return render_template(
        'exam_dashboard.html',
        student=student,
        subject=subject,
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
        student=student,                # ⭐ FULL STUDENT OBJECT
        subject=subject,
        exam_started=session.get('exam_started', False)
    )


# =======================================================
#  SUBMIT EXAM
# =======================================================
@student_portal_bp.route('/submit_exam', methods=['POST'])
def submit_exam():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    session['exam_submitted'] = True
    session['exam_started'] = False
    return redirect(url_for('student_portal_bp.result'))


# =======================================================
#  RESULT PAGE
# =======================================================
@student_portal_bp.route('/result')
def result():
    student = get_logged_in_student()
    if not student:
        return redirect(url_for('user_bp.student_login'))

    latest_result = {
        "score": None,
        "status": "No exam record yet"
    }

    return render_template(
        'result.html',
        student=student,
        result=latest_result
    )
