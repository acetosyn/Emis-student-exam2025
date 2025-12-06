# ============================================================
# convert_test.py — FULL JSON REGENERATOR (2025 PATCHED EDITION)
# Works with the NEW convert.py (stable, crash-resistant)
# ============================================================

import os
import time
from convert import (
    convert_exam,
    save_output,
    detect_subject,
    detect_class_category,
    detect_version,
    class_from_version,
)

BASE_DOCX = "static/subjects/subjects-docx"
BASE_JSON = "static/subjects/subjects-json"

# Ensure JSON folders exist for SS1, SS2, SS3
for cls in ["SS1", "SS2", "SS3", "GENERAL"]:
    os.makedirs(os.path.join(BASE_JSON, cls), exist_ok=True)


# ------------------------------------------------------------
# CLEAN OLD JSON FILES
# ------------------------------------------------------------
def clear_old_jsons():
    print("\n=== 🧹 Clearing old JSON folders ===\n")

    missing = []

    for cls in ["SS1", "SS2", "SS3"]:
        folder = os.path.join(BASE_JSON, cls)

        if not os.path.exists(folder):
            missing.append(folder)
            os.makedirs(folder, exist_ok=True)

        for file in os.listdir(folder):
            if file.endswith(".json"):
                path = os.path.join(folder, file)
                print(f"🗑 Removing old → {path}")
                try:
                    os.remove(path)
                except PermissionError:
                    print(f"⚠ Could not delete (locked): {path}")

    if missing:
        print(f"📁 Created missing folders: {missing}")

    print("\n✅ All old JSON files cleared.\n")


# ------------------------------------------------------------
# SAFE CONVERSION WRAPPER (retry logic)
# ------------------------------------------------------------
def safe_convert(full_path, filename, max_retries=2):
    retries = 0

    while retries <= max_retries:
        try:
            return convert_exam(full_path)

        except Exception as e:
            print(f"\n⚠ ERROR processing {filename}")
            print(f"   Reason: {e}")

            retries += 1

            if retries <= max_retries:
                print(f"🔁 Retrying ({retries}/{max_retries}) …")
                time.sleep(2)
            else:
                print("⛔ Giving up on this file — skipping to next.\n")
                return None


# ------------------------------------------------------------
# PROCESS ALL DOCX FILES
# ------------------------------------------------------------
def convert_all():
    print("\n=== 🚀 STARTING FULL CONVERSION ===\n")

    if not os.path.exists(BASE_DOCX):
        print(f"❌ DOCX folder not found: {BASE_DOCX}")
        return

    docx_files = sorted([f for f in os.listdir(BASE_DOCX) if f.endswith(".docx")])

    if not docx_files:
        print("❌ No DOCX files in subjects-docx")
        return

    for filename in docx_files:
        print(f"\n📘 Converting: {filename}")
        full_path = os.path.join(BASE_DOCX, filename)

        result = safe_convert(full_path, filename)

        if not result:
            continue  # skip corrupted file

        subject, class_cat, data = result

        save_output(subject, class_cat, data)

        print(f"✅ Completed → {filename}\n")

    print("\n🎉 DONE — All subjects processed.\n")


# ------------------------------------------------------------
# MAIN ENTRY
# ------------------------------------------------------------
if __name__ == "__main__":
    clear_old_jsons()
    convert_all()
