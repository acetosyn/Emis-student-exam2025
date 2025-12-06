# ============================================================
# convert_test.py — MASS JSON REGENERATOR (2025 DIAGRAM VERSION)
# ------------------------------------------------------------
# Uses the updated convert.py (with Option-A JSON repair engine)
# • Regenerates ALL JSON files cleanly
# • Clears old JSONs before generating new ones
# ============================================================

import os
import time
from convert import convert_exam, save_output

BASE_DOCX = "static/subjects/subjects-docx"
BASE_JSON = "static/subjects/subjects-json"

# Create required JSON folders
for cls in ["SS1", "SS2", "SS3", "GENERAL"]:
    os.makedirs(os.path.join(BASE_JSON, cls), exist_ok=True)


# ============================================================
# CLEAN OLD JSON FILES
# ============================================================
def clear_old_jsons():
    print("\n=== 🧹 Clearing old JSON folders ===\n")

    for cls in ["SS1", "SS2", "SS3", "GENERAL"]:
        folder = os.path.join(BASE_JSON, cls)

        if not os.path.exists(folder):
            os.makedirs(folder)

        for file in os.listdir(folder):
            if file.endswith(".json"):
                path = os.path.join(folder, file)
                print(f"🗑 Removing → {path}")
                try:
                    os.remove(path)
                except PermissionError:
                    print(f"⚠ Skipped locked file → {path}")

    print("\n✅ All old JSON files cleared.\n")


# ============================================================
# SAFE CONVERSION WRAPPER
# ============================================================
def safe_convert(full_path, filename, max_retries=2):
    retries = 0

    while retries <= max_retries:
        try:
            return convert_exam(full_path)

        except Exception as e:
            print(f"\n⚠ ERROR converting {filename}")
            print(f"   Reason: {e}\n")

            retries += 1
            if retries <= max_retries:
                print(f"🔁 Retrying {retries}/{max_retries} …")
                time.sleep(2)
            else:
                print("⛔ Conversion FAILED — Skipping.\n")
                return None


# ============================================================
# PROCESS ALL DOCX FILES
# ============================================================
def convert_all():
    print("\n=== 🚀 STARTING MASS JSON CONVERSION ===\n")

    if not os.path.exists(BASE_DOCX):
        print(f"❌ DOCX folder missing: {BASE_DOCX}")
        return

    docx_files = sorted([f for f in os.listdir(BASE_DOCX) if f.endswith(".docx")])

    if not docx_files:
        print("❌ No .docx files found in subjects-docx")
        return

    for filename in docx_files:
        print(f"\n📘 Converting: {filename}")
        full_path = os.path.join(BASE_DOCX, filename)

        result = safe_convert(full_path, filename)
        if not result:
            continue  # skip failed ones

        subject, class_cat, data = result

        save_output(subject, class_cat, data)

        print(f"✅ Successfully completed → {filename}\n")

    print("\n🎉 DONE — All subjects processed successfully!\n")


# ============================================================
# MAIN ENTRY
# ============================================================
if __name__ == "__main__":
    clear_old_jsons()
    convert_all()
