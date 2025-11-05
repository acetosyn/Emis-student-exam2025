# modules/api_routes.py
from flask import Blueprint, jsonify, request, session, current_app
from datetime import datetime
from threading import Thread
from pathlib import Path
import csv
import user_credentials
import user_exam
import email_server

api_bp = Blueprint('api_bp', __name__)
BASE_DIR = Path(__file__).resolve().parent.parent
LOGS_DIR = BASE_DIR / "logs"


# -------------------- Async email sender --------------------
def _send_emails_async(result_payload: dict):
    try:
        status = email_server.send_result_emails(result_payload)
        # use Flask's current_app for logging when available
        try:
            current_app.logger.info(f"[email] send_result_emails -> {status}")
        except Exception:
            print(f"[email] send_result_emails -> {status}")
    except Exception as e:
        try:
            current_app.logger.exception(f"[email] send_result_emails failed: {e}")
        except Exception:
            print(f"[email] send_result_emails failed: {e}")


# -------------------- Generate Credentials --------------------
@api_bp.route('/generate_credentials', methods=['POST'])
def generate_credentials_route():
    if session.get('user_type') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    count = int(request.form.get("count", 1))
    prefix = request.form.get("prefix", "candidate")
    pwd_length = int(request.form.get("pwd_length", 8))
    result = user_credentials.generate_credentials(count, prefix, pwd_length)
    return jsonify(result)


# -------------------- List Credentials --------------------
@api_bp.route('/list_credentials')
def list_credentials():
    if session.get('user_type') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify(user_credentials.get_credentials())


# -------------------- Mark Issued --------------------
@api_bp.route('/mark_issued', methods=['POST'])
def mark_issued():
    if session.get('user_type') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    usernames = request.json.get("usernames", [])
    ok = user_credentials.mark_issued(usernames)
    return jsonify({"success": ok})


# -------------------- Exam Submission --------------------
@api_bp.route('/api/exam/submit', methods=['POST'])
def api_exam_submit():
    if session.get('user_type') != 'user':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json or {}
    username = session.get("username")
    fullname = session.get("full_name")
    subject = session.get("subject")
    email = session.get("email")

    score = data.get("score", 0)
    correct = data.get("correct", 0)
    total = data.get("total", 0)
    answered = data.get("answered", 0)
    time_taken = data.get("timeTaken", 0)
    submitted_at = data.get("submittedAt") or datetime.utcnow().isoformat()
    status = data.get("status", "completed")

    user_exam.save_exam_result(
        username=username,
        fullname=fullname,
        email=email,
        subject=subject,
        score=score,
        correct=correct,
        total=total,
        answered=answered,
        time_taken=time_taken,
        submitted_at=submitted_at,
        status=status
    )

    result_payload = {
        "username": username,
        "fullname": fullname,
        "email": email,
        "subject": subject,
        "score": score,
        "correct": correct,
        "total": total,
        "answered": answered,
        "time_taken": time_taken,
        "submitted_at": submitted_at,
        "status": status
    }

    Thread(target=_send_emails_async, args=(result_payload,), daemon=True).start()
    session['exam_submitted'] = True
    session['exam_started'] = False

    return jsonify({"success": True, "message": f"Exam result recorded ({status})"})


# -------------------- Unified Exam Results API --------------------
@api_bp.route('/api/exam/results')
def api_exam_results():
    if session.get('user_type') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    subject = request.args.get("subject")
    from_date = request.args.get("from")
    to_date = request.args.get("to")

    try:
        results = user_exam.get_exam_results() or []

        if subject and subject.lower() != "all":
            results = [r for r in results if (r.get("subject") or "").lower() == subject.lower()]

        def parse_date(d):
            try:
                return datetime.fromisoformat(d.replace("Z", ""))
            except:
                return None

        if from_date:
            from_dt = parse_date(from_date)
            results = [r for r in results if parse_date(r.get("submitted_at")) and parse_date(r["submitted_at"]) >= from_dt]
        if to_date:
            to_dt = parse_date(to_date)
            results = [r for r in results if parse_date(r.get("submitted_at")) and parse_date(r["submitted_at"]) <= to_dt]

        results.sort(key=lambda r: r.get("submitted_at", ""), reverse=True)
        return jsonify({"results": results})

    except Exception as e:
        print(f"⚠️ Error fetching results: {e}")
        return jsonify({"results": []})


# -------------------- Delete Single Result --------------------
@api_bp.route("/delete_result", methods=["POST"])
def delete_result():
    if session.get("user_type") != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json or {}
    username = data.get("username")
    if not username:
        return jsonify({"error": "Username required"}), 400

    try:
        ok = user_exam.delete_result(username)
        if ok:
            return jsonify({"success": True, "message": f"Deleted result for {username}"})
        return jsonify({"success": False, "message": "Result not found"})
    except Exception as e:
        print(f"⚠️ Delete result error: {e}")
        return jsonify({"success": False, "message": str(e)})


# -------------------- Clear Results --------------------
@api_bp.route("/clear_results", methods=["POST"])
def clear_results():
    if session.get("user_type") != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json or {}
    subject = data.get("subject")
    from_date = data.get("from")
    to_date = data.get("to")

    try:
        count = user_exam.clear_results(subject=subject, from_date=from_date, to_date=to_date)
        return jsonify({"success": True, "deleted": count})
    except Exception as e:
        print(f"⚠️ Clear results error: {e}")
        return jsonify({"success": False, "message": str(e)})


# -------------------- Debug Email --------------------
@api_bp.route("/debug/email_test")
def debug_email_test():
    from email_server import send_test_email
    ok = send_test_email()
    return {"sent": ok}
