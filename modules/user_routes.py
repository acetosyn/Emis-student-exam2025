# modules/user_routes.py  (now serving STUDENTS)
from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify

user_bp = Blueprint('user_bp', __name__)


# =======================================================
#  STUDENT LOGIN  (renders student_login.html)
# =======================================================
@user_bp.route('/student_login', methods=['GET', 'POST'])
def student_login():
    if request.method == 'POST':
        admission_number = request.form.get('admission_number', '').strip()
        first_name = request.form.get('first_name', '').strip()

        # ⚠️ Supabase login NOT implemented yet
        # For now, just redirect to student portal if fields are not empty
        if admission_number and first_name:
            session.clear()
            session['user_type'] = 'student'
            session['admission_number'] = admission_number
            session['first_name'] = first_name
            session['exam_started'] = False
            session['exam_submitted'] = False

            return redirect(url_for('user_bp.student_portal'))

        return render_template('student_login.html', error="Invalid login details")

    return render_template('student_login.html')


# =======================================================
#  STUDENT PORTAL
# =======================================================
@user_bp.route('/student_portal')
def student_portal():
    if session.get('user_type') != 'student':
        return redirect(url_for('user_bp.student_login'))

    return render_template(
        'student_portal.html',
        first_name=session.get('first_name'),
        admission_number=session.get('admission_number'),
        exam_started=session.get('exam_started', False),
        exam_submitted=session.get('exam_submitted', False)
    )


# =======================================================
#  START EXAM
# =======================================================
@user_bp.route('/start_exam', methods=['POST'])
def start_exam():
    if session.get('user_type') != 'student':
        return redirect(url_for('user_bp.student_login'))

    if session.get('exam_submitted'):
        return redirect(url_for('user_bp.result'))

    session['exam_started'] = True
    return redirect(url_for('user_bp.exam'))


# =======================================================
#  EXAM PAGE
# =======================================================
@user_bp.route('/exam')
def exam():
    if session.get('user_type') != 'student':
        return redirect(url_for('user_bp.student_login'))

    return render_template(
        'exam.html',
        first_name=session.get('first_name'),
        admission_number=session.get('admission_number'),
        exam_started=session.get('exam_started', False)
    )


# =======================================================
#  SUBMIT EXAM
# =======================================================
@user_bp.route('/submit_exam', methods=['POST'])
def submit_exam():
    if session.get('user_type') != 'student':
        return redirect(url_for('user_bp.student_login'))

    session['exam_submitted'] = True
    session['exam_started'] = False
    return redirect(url_for('user_bp.result'))


# =======================================================
#  RESULT PAGE
# =======================================================
@user_bp.route('/result')
def result():
    if session.get('user_type') != 'student':
        return redirect(url_for('user_bp.student_login'))

    # Placeholder result for now
    latest_result = {
        "score": None,
        "status": "No exam record yet"
    }

    return render_template(
        'result.html',
        first_name=session.get('first_name'),
        admission_number=session.get('admission_number'),
        result=latest_result
    )


# =======================================================
#  LOGOUT
# =======================================================
@user_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('user_bp.student_login'))
