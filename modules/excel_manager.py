import os
from pathlib import Path
from openpyxl import Workbook, load_workbook
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent

# ================================================
#  NEW STORAGE ROOT:
#  RESULTS/<YEAR>/CLASS/<SSx>/<Subject>/results.xlsx
# ================================================
RESULTS_BASE = BASE_DIR / "RESULTS"


# -----------------------------------
# Ensure folder exists
# -----------------------------------
def ensure_folder(path: Path):
    path.mkdir(parents=True, exist_ok=True)
    return path


# -----------------------------------
# Normalize subject folder name (FULL MAPPING)
# -----------------------------------
def normalize_subject(subject: str):
    if not subject:
        return "Unknown"

    key = subject.strip().lower()

    mapping = {
        # CORE SUBJECTS (13)
        "biology": "Biology",
        "chemistry": "Chemistry",
        "civic education": "Civic_education",
        "civic": "Civic_education",

        "computer science": "Computer_studies",
        "computer studies": "Computer_studies",
        "computer": "Computer_studies",

        "economics": "Economics",

        "english language": "English_language",
        "english": "English_language",

        "financial accounting": "Financial_accounting",
        "accounting": "Financial_accounting",

        "geography": "Geography",
        "government": "Government",

        "literature-in-english": "Literature",
        "literature": "Literature",

        "mathematics": "Mathematics",
        "maths": "Mathematics",

        "physics": "Physics",

        "technical drawing": "Technical",
        "technical": "Technical",
    }

    # Return mapped folder
    if key in mapping:
        return mapping[key]

    # Fallback for unknown subjects
    return subject.strip().replace(" ", "_").replace("-", "_").capitalize()


# ----------------------------------------------
# Build Excel file path — YEAR AWARE VERSION
# RESULTS/<YEAR>/CLASS/<SS1>/<Subject>/results.xlsx
# ----------------------------------------------
def get_excel_path(class_category: str, subject: str, year: str):
    """
    Constructs:
    RESULTS/<YEAR>/CLASS/<SS1>/<Subject>/results.xlsx
    """
    year_folder = ensure_folder(RESULTS_BASE / str(year))
    class_root = ensure_folder(year_folder / "CLASS")
    class_folder = ensure_folder(class_root / class_category.upper())
    subject_folder = ensure_folder(class_folder / normalize_subject(subject))

    return subject_folder / "results.xlsx"


# -----------------------------------
# Auto-repair headers — SAFE VERSION
# -----------------------------------
# Canonical header schema the app will use internally
EXPECTED_HEADERS = [
    "Student Name",
    "Admission No",
    "Class",
    "Subject",
    "Score (%)",
    "Correct",
    "Total",
    "Status",
    "Time Taken",      # ⭐ NEW CANONICAL COLUMN
    "Submitted At",
]


def repair_missing_headers(ws):
    """
    Safely handle empty sheets or missing headers.
    Returns the cleaned header row or empty list.
    """

    rows = list(ws.iter_rows(values_only=True))

    # EMPTY SHEET → add headers
    if not rows:
        for col, val in enumerate(EXPECTED_HEADERS, start=1):
            ws.cell(row=1, column=col).value = val
        return EXPECTED_HEADERS

    first_row = list(rows[0])

    # Completely empty header → repair
    if all(cell is None for cell in first_row):
        for col, val in enumerate(EXPECTED_HEADERS, start=1):
            ws.cell(row=1, column=col).value = val
        return EXPECTED_HEADERS

    # Broken numeric header → repair
    if all(isinstance(cell, int) for cell in first_row):
        for col, val in enumerate(EXPECTED_HEADERS, start=1):
            ws.cell(row=1, column=col).value = val
        return EXPECTED_HEADERS

    # Otherwise OK — return the sheet's header row as-is
    return first_row


# -----------------------------------
# Append result to Excel (YEAR-AWARE)
# -----------------------------------
def append_result_to_excel(result: dict):

    class_cat = result.get("class_category", "UNKNOWN").upper()
    subject = result.get("subject", "UNKNOWN")
    year = str(result.get("year", datetime.now().year))  # REQUIRED

    excel_path = get_excel_path(class_cat, subject, year)

    # Create workbook if file missing
    if not excel_path.exists():
        wb = Workbook()
        ws = wb.active
        # Header row aligned with EXPECTED_HEADERS
        ws.append([
            "Student Name",
            "Admission No",   # ⭐ unified with EXPECTED_HEADERS / admin JS
            "Class",
            "Subject",
            "Score (%)",
            "Correct",
            "Total",
            "Status",
            "Time Taken",     # ⭐ NEW COLUMN
            "Submitted At",
        ])
        wb.save(excel_path)

    wb = load_workbook(excel_path)
    ws = wb.active

    # Extract values
    score_percent = result.get("score", 0)
    status = "PASS" if score_percent >= 50 else "FAIL"

    # ⭐ GUARANTEED TIME TAKEN FROM DB
    time_taken = (
        result.get("time_taken") or
        result.get("timeTaken") or
        0
    )

    # Append row including time taken
    ws.append([
        result.get("full_name"),
        result.get("admission_number"),
        result.get("class_name"),
        subject,
        f"{score_percent}%",
        result.get("correct", 0),
        result.get("total", 0),
        status,
        time_taken,  # ⭐ NEW VALUE STORED PROPERLY (seconds)
        datetime.now().strftime("%Y-%m-%d %H:%M"),
    ])

    wb.save(excel_path)
    return True


# -----------------------------------
# Read Excel results (YEAR AWARE)
# -----------------------------------
def read_results(class_category: str, subject: str, year: str):

    excel_path = get_excel_path(class_category, subject, year)

    if not excel_path.exists():
        return []

    wb = load_workbook(excel_path)
    ws = wb.active

    # Still repair obviously broken headers (empty / numeric)
    headers = repair_missing_headers(ws)
    rows = list(ws.iter_rows(values_only=True))

    if len(rows) < 2:
        return []

    data = []

    # We trust position of columns more than names so we can support:
    #  - old 9-column files (no "Time Taken")
    #  - new 10-column files (with "Time Taken")
    for row in rows[1:]:
        values = list(row)

        if len(values) == 10:
            # New format:
            # [0] Student Name
            # [1] Admission (No / Number)
            # [2] Class
            # [3] Subject
            # [4] Score (%)
            # [5] Correct
            # [6] Total
            # [7] Status
            # [8] Time Taken
            # [9] Submitted At
            mapped_values = values[:10]

        elif len(values) == 9:
            # Old format (NO Time Taken saved):
            # [0] Student Name
            # [1] Admission No
            # [2] Class
            # [3] Subject
            # [4] Score (%)
            # [5] Correct
            # [6] Total
            # [7] Status
            # [8] Submitted At
            #
            # We insert a None for "Time Taken" at index 8
            mapped_values = values[:8] + [None, values[8]]

        else:
            # Fallback: pad or trim to match EXPECTED_HEADERS length
            mapped_values = values[:len(EXPECTED_HEADERS)]
            if len(mapped_values) < len(EXPECTED_HEADERS):
                mapped_values += [None] * (len(EXPECTED_HEADERS) - len(mapped_values))

        row_dict = dict(zip(EXPECTED_HEADERS, mapped_values))

        # Backwards compatibility: if some old sheet used "Admission Number" key,
        # make sure "Admission No" is always populated.
        if "Admission No" not in row_dict:
            # Try to find the value by header scan
            try:
                idx = headers.index("Admission Number")
                row_dict["Admission No"] = row[idx]
            except Exception:
                # If we can't find it, just leave as-is
                pass

        data.append(row_dict)

    return data


# -----------------------------------
# Student history across YEARS
# -----------------------------------
def read_student_history(full_name: str, class_category: str):
    results = []

    # Loop through ALL YEARS inside RESULTS/
    if not RESULTS_BASE.exists():
        return results

    for year_folder in RESULTS_BASE.iterdir():
        if not year_folder.is_dir():
            continue

        class_root = year_folder / "CLASS" / class_category.upper()
        if not class_root.exists():
            continue

        # Scan subjects
        for subject_folder in class_root.iterdir():
            excel_file = subject_folder / "results.xlsx"
            if not excel_file.exists():
                continue

            wb = load_workbook(excel_file)
            ws = wb.active
            headers = repair_missing_headers(ws)
            rows = list(ws.iter_rows(values_only=True))

            if len(rows) < 2:
                continue

            for row in rows[1:]:
                row_dict = dict(zip(headers, row))
                if str(row_dict.get("Student Name", "")).strip().upper() == full_name.strip().upper():
                    row_dict["Year"] = year_folder.name  # add YEAR metadata
                    results.append(row_dict)

    return results
