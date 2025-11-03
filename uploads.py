# uploads.py
from flask import Blueprint, render_template, session, jsonify

upload_bp = Blueprint("upload_bp", __name__)

@upload_bp.route("/uploads")
def uploads_page():
    """Serve the dynamic uploads sub-page for teachers/admin."""
    if session.get("user_type") != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    return render_template("uploads.html")

# Optional alias
@upload_bp.route("/uploads.html")
def uploads_html_alias():
    return uploads_page()
