# modules/student_results.py

import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path("database.db")


# ============================================================
#   INIT — CREATE CLEAN NEW RESULTS TABLE
# ============================================================
def init_db():
    """Creates a clean results table matching the new exam system."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS student_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            -- Student Info
            student_id TEXT NOT NULL,
            full_name TEXT NOT NULL,
            admission_number TEXT NOT NULL,
            class_name TEXT,
            class_category TEXT,

            -- Exam Details
            subject TEXT NOT NULL,
            score INTEGER NOT NULL,
            correct INTEGER,
            incorrect INTEGER,
            total INTEGER,
            answered INTEGER,
            skipped INTEGER,
            flagged INTEGER,
            tab_switches INTEGER,
            time_taken INTEGER,

            submitted_at TEXT NOT NULL,
            status TEXT DEFAULT 'completed'
        )
    """)

    conn.commit()
    conn.close()



# ============================================================
#   SAVE RESULT  — FINAL VERSION (SQLite + Excel)
# ============================================================
from modules.excel_manager import append_result_to_excel

def save_result(data: dict):
    """
    Saves a student's exam result into:
    - SQLite database
    - Excel folder structure (CLASS/SS1/Subject/results.xlsx)
    """

    init_db()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Timestamp
    submitted_at = data.get("submittedAt") or datetime.now().isoformat()

    # Defensive extraction
    total = int(data.get("total") or 0)
    correct = int(data.get("correct") or 0)
    answered = int(data.get("answered") or 0)

    incorrect = total - correct
    skipped = total - answered

    # ================================
    # 1️⃣ SAVE TO SQLITE
    # ================================
    cursor.execute("""
        INSERT INTO student_results (
            student_id, full_name, admission_number,
            class_name, class_category,
            subject, score, correct, incorrect,
            total, answered, skipped, flagged,
            tab_switches, time_taken,
            submitted_at, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("student_id"),
        data.get("full_name"),
        data.get("admission_number"),
        data.get("class_name"),
        data.get("class_category"),

        data.get("subject"),
        data.get("score"),               # percent
        correct,
        incorrect,
        total,
        answered,
        skipped,

        data.get("flagged", 0),
        data.get("tabSwitches", 0),

        data.get("time_taken") or data.get("timeTaken", 0),
        submitted_at,
        data.get("status", "completed")
    ))

    conn.commit()
    conn.close()

    # ================================
    # 2️⃣ SAVE TO EXCEL
    # ================================
    excel_payload = {
        "full_name": data.get("full_name"),
        "admission_number": data.get("admission_number"),
        "class_name": data.get("class_name"),
        "class_category": data.get("class_category"),
        "subject": data.get("subject"),

        "score": data.get("score") or 0,
        "correct": correct,
        "total": total,

        "submitted_at": submitted_at
    }

    append_result_to_excel(excel_payload)

    return True



# ============================================================
#   GET LATEST RESULT FOR A STUDENT
# ============================================================
def get_latest_result(student_id):
    """Returns the most recent exam result for a specific student."""
    init_db()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            student_id, full_name, admission_number,
            class_name, class_category,
            subject, score, correct, incorrect,
            total, answered, skipped, flagged,
            tab_switches, time_taken,
            submitted_at, status
        FROM student_results
        WHERE student_id = ?
        ORDER BY id DESC
        LIMIT 1
    """, (student_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "student_id": row[0],
        "full_name": row[1],
        "admission_number": row[2],
        "class_name": row[3],
        "class_category": row[4],
        "subject": row[5],
        "score": row[6],
        "correct": row[7],
        "incorrect": row[8],
        "total": row[9],
        "answered": row[10],
        "skipped": row[11],
        "flagged": row[12],
        "tabSwitches": row[13],
        "time_taken": row[14],
        "submitted_at": row[15],
        "status": row[16]
    }



# ============================================================
#   FOR ADMIN — GET ALL RESULTS
# ============================================================
def get_all_results(limit=200):
    """Returns latest exam results for admin dashboard."""
    init_db()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            student_id, full_name, admission_number,
            class_name, class_category,
            subject, score, correct, incorrect,
            total, answered, skipped, flagged,
            tab_switches, time_taken,
            submitted_at, status
        FROM student_results
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "student_id": r[0],
            "full_name": r[1],
            "admission_number": r[2],
            "class_name": r[3],
            "class_category": r[4],
            "subject": r[5],
            "score": r[6],
            "correct": r[7],
            "incorrect": r[8],
            "total": r[9],
            "answered": r[10],
            "skipped": r[11],
            "flagged": r[12],
            "tabSwitches": r[13],
            "time_taken": r[14],
            "submitted_at": r[15],
            "status": r[16],
        })

    return results
