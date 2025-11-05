# modules/user_routes.py
from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify
import user_credentials
import user_exam

user_bp = Blueprint('user_bp', __name__)


# -------------------- USER LOGIN --------------------
@user_bp.route('/user_login', methods=['GET', 'POST'])
def user_login():
    if request.method == 'POST':
        full_name = request.form.get('full_name', '').strip()
        email = request.form.get('email', '').strip()
        gender = request.form.get('gender', '').strip()
        subject = request.form.get('subject', '').strip()
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        if user_credentials.validate_credentials(username, password):
            session.clear()
            session['user_type'] = 'user'
            session['username'] = username
            session['full_name'] = full_name
            session['email'] = email
            session['gender'] = gender
            session['subject'] = subject
            session['exam_started'] = False
            session['exam_submitted'] = False
            return redirect(url_for('user_bp.user_portal'))

        return render_template('user_login.html', error="Invalid login details")

    return render_template('user_login.html')


# -------------------- USER PORTAL --------------------
@user_bp.route('/user_portal')
def user_portal():
    if session.get('user_type') != 'user':
        return redirect(url_for('user_bp.user_login'))

    return render_template(
        'user_portal.html',
        full_name=session.get('full_name'),
        username=session.get('username'),
        email=session.get('email'),
        gender=session.get('gender'),
        subject=session.get('subject'),
        exam_started=session.get('exam_started', False),
        exam_submitted=session.get('exam_submitted', False)
    )


# -------------------- START EXAM --------------------
@user_bp.route('/start_exam', methods=['POST'])
def start_exam():
    if session.get('user_type') != 'user':
        return redirect(url_for('user_bp.user_login'))

    if session.get('exam_submitted'):
        return redirect(url_for('user_bp.result'))

    session['exam_started'] = True
    return redirect(url_for('user_bp.exam'))


# -------------------- EXAM PAGE --------------------
@user_bp.route('/exam')
def exam():
    if session.get('user_type') != 'user':
        return redirect(url_for('user_bp.user_login'))

    return render_template(
        'exam.html',
        full_name=session.get('full_name'),
        username=session.get('username'),
        subject=session.get('subject'),
        exam_started=session.get('exam_started', False)
    )


# -------------------- SUBMIT / END EXAM --------------------
@user_bp.route('/submit_exam', methods=['POST'])
def submit_exam():
    if session.get('user_type') != 'user':
        return redirect(url_for('user_bp.user_login'))

    session['exam_submitted'] = True
    session['exam_started'] = False
    return redirect(url_for('user_bp.result'))


# -------------------- RESULT PAGE --------------------
@user_bp.route('/result')
def result():
    if session.get('user_type') != 'user':
        return redirect(url_for('user_bp.user_login'))

    username = session.get('username')
    latest = user_exam.get_user_latest_result(username)

    return render_template(
        'result.html',
        full_name=session.get('full_name'),
        username=username,
        result=latest or {}
    )


# -------------------- LOGOUT --------------------
@user_bp.route('/logout')
def logout():
    user_type = session.get('user_type')
    session.clear()
    if user_type == 'user':
        return redirect(url_for('user_bp.user_login'))
    return redirect(url_for('admin_bp.admin_login'))
