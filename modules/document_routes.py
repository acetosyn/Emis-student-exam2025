# modules/document_routes.py
from flask import Blueprint, jsonify, request, session, redirect, url_for, render_template
import os
from uploads import (
    handle_upload,
    list_converted_files,
    get_converted_json,
    delete_converted_file
)

# --------------------------------------------------------
# DOCUMENT ROUTES — Handles Admin Upload & JSON Conversion
# --------------------------------------------------------

document_bp = Blueprint("document_bp", __name__)

# -------------------- ADMIN UPLOAD PAGE --------------------
@document_bp.route("/admin/uploads")
def uploads_page():
    """Render Uploads page for admin panel."""
    if session.get("user_type") != "admin":
        return redirect(url_for("admin_bp.admin_login"))
    return render_template("uploads.html")


# -------------------- API: Upload Document(s) --------------------
@document_bp.route("/api/upload", methods=["POST"])
def api_upload():
    """Handles DOCX/JSON uploads + conversion to JSON."""
    if session.get("user_type") != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    try:
        return handle_upload(request)
    except Exception as e:
        print(f"⚠️ Upload error: {e}")
        return jsonify({"error": str(e)}), 500


# -------------------- API: List All Converted JSON Files --------------------
@document_bp.route("/api/uploads", methods=["GET"])
def api_list_uploads():
    """Lists all converted JSON files available in /uploads."""
    if session.get("user_type") != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    try:
        uploads = list_converted_files()
        return jsonify({"uploads": uploads})
    except Exception as e:
        print(f"⚠️ List error: {e}")
        return jsonify({"error": str(e)}), 500


# -------------------- API: View a Converted JSON File --------------------
@document_bp.route("/api/uploads/<string:filename>", methods=["GET"])
def api_view_upload(filename):
    """Returns contents of a selected converted JSON file."""
    if session.get("user_type") != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    try:
        return get_converted_json(filename)
    except Exception as e:
        print(f"⚠️ View error: {e}")
        return jsonify({"error": str(e)}), 500


# -------------------- API: Delete a Converted JSON File --------------------
@document_bp.route("/api/uploads/<string:filename>", methods=["DELETE"])
def api_delete_upload(filename):
    """Deletes a selected converted JSON file."""
    if session.get("user_type") != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    try:
        return delete_converted_file(filename)
    except Exception as e:
        print(f"⚠️ Delete error: {e}")
        return jsonify({"error": str(e)}), 500
