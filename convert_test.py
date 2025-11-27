# convert_test.py
import os
import shutil
from convert import (
    detect_subject,
    detect_version,
    detect_class_category,
    convert_exam,
    save_output
)

SUBJECTS_DIR = "subjects"
JSON_DIR = "subjects-json"


# ---------------------------------------------------------
# MAP VERSION → CLASS
# ---------------------------------------------------------
def class_from_version(version):
    if version == "1": return "SS1"
    if version == "2": return "SS2"
    if version == "3": return "SS3"
    return "GENERAL"


# ---------------------------------------------------------
# RENAME OLD JSON FILES INTO SS1/SS2/SS3
# ---------------------------------------------------------
def rename_old_jsons():
    print("\n=== 🔄 Fixing Old JSON Files ===\n")

    for f in os.listdir(JSON_DIR):
        if not f.lower().endswith(".json"):
            continue
        if f == "pushed_subjects.json":
            continue

        old_path = os.path.join(JSON_DIR, f)

        subject = detect_subject(f)
        version = detect_version(f)
        class_cat = detect_class_category(f)

        # Map old filenames like accounts1.json
        if class_cat == "GENERAL":
            class_cat = class_from_version(version)

        safe = subject.lower().replace(" ", "_")
        class_folder = class_cat.upper()

        target_dir = os.path.join(JSON_DIR, class_folder)
        os.makedirs(target_dir, exist_ok=True)

        new_name = f"{safe}_{class_cat.lower()}.json"
        new_path = os.path.join(target_dir, new_name)

        print(f"📁 Moving {f} → {new_path}")
        shutil.move(old_path, new_path)

    print("\n✅ JSON Rename Completed!\n")


# ---------------------------------------------------------
# TRACK EXISTING JSON
# RETURNS SET OF (subject, CLASS)
# ---------------------------------------------------------
def get_existing_json_map():
    existing = set()

    for root, dirs, files in os.walk(JSON_DIR):
        for f in files:
            if not f.endswith(".json"):
                continue
            if f == "pushed_subjects.json":
                continue

            name = f.replace(".json", "")

            try:
                subj, cls = name.rsplit("_", 1)
                existing.add((subj.lower(), cls.upper()))
            except:
                pass

    return existing


# ---------------------------------------------------------
# AUTO-RESUME CONVERSION
# ---------------------------------------------------------
def resume_conversion():
    print("\n=== 🚀 Resuming Remaining Conversions ===\n")

    existing = get_existing_json_map()
    docx_files = sorted([f for f in os.listdir(SUBJECTS_DIR) if f.endswith(".docx")])

    if not docx_files:
        print("❌ No DOCX files found.")
        return

    for filename in docx_files:
        subject = detect_subject(filename)
        class_cat = detect_class_category(filename)

        # Map accounts1 → SS1
        if class_cat == "GENERAL":
            class_cat = class_from_version(detect_version(filename))

        safe_subject = subject.lower().replace(" ", "_")

        # Skip if this subject/class already exists
        if (safe_subject, class_cat.upper()) in existing:
            print(f"⏭ SKIP (already done): {filename}")
            continue

        print(f"\n📘 Converting: {filename}")

        try:
            path = os.path.join(SUBJECTS_DIR, filename)

            # convert_exam RETURNS: (subject, data, class_cat)
            subject, data, class_cat = convert_exam(path)

            # Save JSON
            save_output(subject, data, class_cat)

            print(f"✅ Done → {filename}")

        except Exception as e:
            print(f"❌ ERROR converting {filename}: {e}")
            print("Stopping so you don't waste API.")
            break


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
if __name__ == "__main__":
    rename_old_jsons()
    resume_conversion()
    print("\n🎉 ALL DONE — Resume Mode Safe\n")
