import os
from pathlib import Path
from openpyxl import Workbook, load_workbook
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = BASE_DIR / "CLASS"   # FINAL STORAGE ROOT


# -----------------------------------
# Ensure folder exists
# -----------------------------------
def ensure_folder(path: Path):
    path.mkdir(parents=True, exist_ok=True)
    return path


# -----------------------------------
# Normalize subject folder name
# -----------------------------------
def normalize_subject(subject: str):
    if not subject:
        return "Unknown"
    return subject.strip().replace(" ", "_").replace("-", "_").capitalize()


# -----------------------------------
# Build Excel file path
# CLASS/SS1/Biology/results.xlsx
# -----------------------------------
def get_excel_path(class_category: str, subject: str):
    class_folder = ensure_folder(RESULTS_DIR / class_category.upper())
    subject_folder = ensure_folder(class_folder / normalize_subject(subject))
    excel_file = subject_folder / "results.xlsx"
    return excel_file


# -----------------------------------
# Append one student's result to the correct file
# -----------------------------------
def append_result_to_excel(result: dict):
    """
    result must include:
    - full_name
    - admission_number
    - class_name
    - class_category
    - subject
    - score
    - correct
    - total
    - submitted_at
    """
    class_cat = result.get("class_category", "UNKNOWN").upper()
    subject = result.get("subject", "UNKNOWN")

    excel_path = get_excel_path(class_cat, subject)

    # Create Excel if missing
    if not excel_path.exists():
        wb = Workbook()
        ws = wb.active
        ws.append([
            "Student Name", "Admission No", "Class", "Subject",
            "Score (%)", "Correct", "Total", "Status", "Submitted At"
        ])
        wb.save(excel_path)

    # Append new row
    wb = load_workbook(excel_path)
    ws = wb.active

    score_percent = result.get("score", 0)
    status = "PASS" if score_percent >= 50 else "FAIL"

    ws.append([
        result.get("full_name"),
        result.get("admission_number"),
        result.get("class_name"),
        subject,
        f"{score_percent}%",
        result.get("correct", 0),
        result.get("total", 0),
        status,
        datetime.now().strftime("%Y-%m-%d %H:%M")
    ])

    wb.save(excel_path)
    return True


# -----------------------------------
# Read result table for admin
# -----------------------------------
def read_results(class_category: str, subject: str):
    excel_path = get_excel_path(class_category, subject)

    if not excel_path.exists():
        return []

    wb = load_workbook(excel_path)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    if not rows:
        return []

    headers = rows[0]
    data = [dict(zip(headers, row)) for row in rows[1:]]
    return data


# -----------------------------------
# Read all results for a student (history)
# -----------------------------------
def read_student_history(full_name: str, class_category: str):
    results = []
    class_dir = RESULTS_DIR / class_category.upper()

    if not class_dir.exists():
        return results

    for subject_folder in class_dir.iterdir():
        excel_file = subject_folder / "results.xlsx"

        if excel_file.exists():
            wb = load_workbook(excel_file)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))

            if len(rows) < 2:
                continue

            headers = rows[0]
            for row in rows[1:]:
                row_dict = dict(zip(headers, row))
                if row_dict.get("Student Name") == full_name:
                    results.append(row_dict)

    return results
