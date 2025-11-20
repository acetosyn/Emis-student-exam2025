# modules/user_routes.py
from flask import Blueprint, render_template, redirect, url_for, session, request
from pathlib import Path
import csv
from modules.supabase_client import supabase   # add this at the top of user_routes.py


user_bp = Blueprint('user_bp', __name__)

BASE_DIR = Path(__file__).resolve().parent.parent
STUDENTS_CSV_PATH = BASE_DIR / "ids" / "SS1_Students.csv"


def _find_student(admission_number: str, first_name: str):
    """Validate student using Supabase and return profile (excluding phone)."""
    adm = (admission_number or "").strip()
    fname = (first_name or "").strip()

    if not adm or not fname:
        return None

    try:
        # Case-insensitive matching with ILIKE
        response = (
            supabase
            .table("SS1_Students")
            .select("*")
            .ilike("Admission_number", adm)
            .ilike("First_name", fname)
            .execute()
        )

        if not response.data:
            print("NO MATCH FOUND")
            return None

        row = response.data[0]

        full_name = " ".join(
            p for p in [
                (row.get("Last_name") or "").strip(),
                (row.get("First_name") or "").strip(),
                (row.get("Other_names") or "").strip()
            ] if p
        )

        return {
            "id": row.get("id"),
            "admission_number": row.get("Admission_number"),
            "first_name": row.get("First_name"),
            "last_name": row.get("Last_name"),
            "other_names": row.get("Other_names"),
            "class": row.get("Class"),
            "full_name": full_name.strip(),
        }

    except Exception as e:
        print("Supabase error:", e)
        return None




# =======================================================
#  STUDENT LOGIN
# =======================================================
@user_bp.route('/student_login', methods=['GET', 'POST'])
def student_login():
    if request.method == 'POST':
        admission_number = request.form.get('admission_number', '').strip()
        first_name = request.form.get('first_name', '').strip()

        student = _find_student(admission_number, first_name)

        if student:
            session.clear()
            session['user_type'] = 'student'
            session['student'] = student
            session['exam_started'] = False
            session['exam_submitted'] = False
            return redirect(url_for('student_portal_bp.student_portal'))

        return render_template(
            'student_login.html',
            error="Invalid admission number or first name",
            admission_number=admission_number,
            first_name=first_name
        )

    return render_template('student_login.html')


# =======================================================
#  LOGOUT
# =======================================================
@user_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('user_bp.student_login'))
