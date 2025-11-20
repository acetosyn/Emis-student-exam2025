# modules/student_portal.py

from flask import Blueprint, render_template, redirect, url_for, session, request

student_portal_bp = Blueprint('student_portal_bp', __name__)

DEFAULT_SUBJECTS = [
    "BIOLOGY", "CHEMISTRY", "COMPUTER STUDIES", "ECONOMICS", "ENGLISH LANGUAGE",
    "GEOGRAPHY", "GOVERNMENT", "MATHEMATICS", "PHYSICS", "TECHNICAL DRAWING",
    "FINANCIAL ACCOUNTING", "LITERATURE-IN-ENGLISH"
]


# =======================================================
#  STUDENT PORTAL (Dashboard)
# =======================================================
@student_portal_bp.route('/student_portal')
def student_portal():
    if session.get('user_type') != 'student':
        return redirect(url_for('user_bp.student_login'))

    student = session.get('student')
    if not student:
        return redirect(url_for('user_bp.student_login'))

    return render_template(
        'students.html',
        first_name=student.get('first_name'),
        student=student,
        subjects=DEFAULT_SUBJECTS,
        exam_started=session.get('exam_started', False),
        exam_submitted=session.get('exam_submitted', False)
    )


# =======================================================
#  START EXAM
# =======================================================
@student_portal_bp.route('/start_exam', methods=['POST'])
def start_exam():
    if session.get('user_type') != 'student' or not session.get('student'):
        return redirect(url_for('user_bp.student_login'))

    if session.get('exam_submitted'):
        return redirect(url_for('student_portal_bp.result'))

    session['exam_started'] = True
    return redirect(url_for('student_portal_bp.exam'))


# =======================================================
#  EXAM PAGE
# =======================================================
@student_portal_bp.route('/exam')
def exam():
    if session.get('user_type') != 'student':
        return redirect(url_for('user_bp.student_login'))

    student = session.get('student')
    if not student:
        return redirect(url_for('user_bp.student_login'))

    return render_template(
        'exam.html',
        first_name=student.get('first_name'),
        admission_number=student.get('admission_number'),
        exam_started=session.get('exam_started', False)
    )


# =======================================================
#  SUBMIT EXAM
# =======================================================
@student_portal_bp.route('/submit_exam', methods=['POST'])
def submit_exam():
    if session.get('user_type') != 'student' or not session.get('student'):
        return redirect(url_for('user_bp.student_login'))

    session['exam_submitted'] = True
    session['exam_started'] = False
    return redirect(url_for('student_portal_bp.result'))


# =======================================================
#  RESULT PAGE
# =======================================================
@student_portal_bp.route('/result')
def result():
    if session.get('user_type') != 'student':
        return redirect(url_for('user_bp.student_login'))

    student = session.get('student')
    if not student:
        return redirect(url_for('user_bp.student_login'))

    latest_result = {
        "score": None,
        "status": "No exam record yet"
    }

    return render_template(
        'result.html',
        first_name=student.get('first_name'),
        admission_number=student.get('admission_number'),
        result=latest_result
    )
