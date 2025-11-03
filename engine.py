# engine.py — handles business logic (file uploads, listing, etc.)
import os, mimetypes, datetime
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx"}
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")  # /uploads in project root
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def save_uploaded_file(file_storage):
    """Save uploaded file securely."""
    if file_storage and allowed_file(file_storage.filename):
        filename = secure_filename(file_storage.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file_storage.save(file_path)
        return {"success": True, "path": file_path, "filename": filename}
    return {"success": False, "error": "Invalid file type"}

def list_documents(query: str | None = None):
    """Return metadata for files in uploads. Optional partial name filter."""
    try:
        files = []
        q = (query or "").strip().lower()
        for name in os.listdir(UPLOAD_FOLDER):
            full = os.path.join(UPLOAD_FOLDER, name)
            if not os.path.isfile(full):
                continue
            ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            if ext not in ALLOWED_EXTENSIONS:
                continue
            if q and q not in name.lower():
                continue
            st = os.stat(full)
            mtime = datetime.datetime.fromtimestamp(st.st_mtime)
            mime, _ = mimetypes.guess_type(full)
            files.append({
                "name": name,
                "ext": ext,
                "size": st.st_size,
                "mtime": st.st_mtime,
                "mtime_str": mtime.strftime("%Y-%m-%d %H:%M"),
                "mime": mime or "application/octet-stream",
                # url built in app.py route /uploads/<filename>
            })
        # newest first
        files.sort(key=lambda x: x["mtime"], reverse=True)
        return files
    except Exception as e:
        return []
