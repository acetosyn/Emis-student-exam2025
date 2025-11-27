// =============================================================
// EMIS STUDENTS.JS — Final Version (Subject Selection + Routing)
// =============================================================

document.addEventListener("DOMContentLoaded", () => {

  // -----------------------------------------------------------
  // 1. ROUTING (optional modules)
  // -----------------------------------------------------------
  const modules = document.querySelectorAll(".module-item");
  const content = document.getElementById("studentDynamicContent");

  if (modules.length > 0 && content) {
    modules.forEach((mod) => {
      mod.addEventListener("click", () => {
        const page = mod.dataset.page;

        content.innerHTML = `
          <div class="route-loader">
            <div class="loader-spinner"></div>
            <p>Loading ${page}...</p>
          </div>`;

        setTimeout(() => {
          window.location.href = page;
        }, 600);
      });
    });
  }

  // -----------------------------------------------------------
  // 2. SUBJECT PREVIEW (Existing)
  // -----------------------------------------------------------
  const subjectsBtn = document.getElementById("openSubjectsBtn");
  const subjectsList = document.getElementById("availableSubjectsList");
  const subjectsCard = document.getElementById("availableSubjectsCard");

  async function loadAvailableSubjects() {
    try {
      const res = await fetch("/api/get_pushed_subjects");

      const data = await res.json();

      const subjects = data.subjects || [];
      subjectsList.innerHTML = "";

      if (subjects.length === 0) {
        subjectsList.innerHTML = `<li class="empty">No subjects available yet.</li>`;
      } else {
        subjects.forEach((sub) => {
          const li = document.createElement("li");
          li.textContent = sub;
          subjectsList.appendChild(li);
        });
      }

      subjectsCard.classList.add("show");
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  }

  subjectsBtn?.addEventListener("click", loadAvailableSubjects);


  // -----------------------------------------------------------
  // 3. SUBJECT DROPDOWN → ENABLE BUTTON → REDIRECT
  // -----------------------------------------------------------
  const subjectDropdown = document.getElementById("subjectDropdown");
  const startExamBtn = document.getElementById("startExamBtn");
  const refreshSubjectsBtn = document.getElementById("refreshSubjectsBtn");

  if (subjectDropdown && startExamBtn) {
    subjectDropdown.addEventListener("change", () => {
      startExamBtn.disabled = (subjectDropdown.value.trim() === "");
    });
  }

  refreshSubjectsBtn?.addEventListener("click", loadAvailableSubjects);

  // Redirect to exam_dashboard
  if (startExamBtn) {
    startExamBtn.addEventListener("click", () => {
      const subject = subjectDropdown.value.trim();
      if (!subject) return;

      window.location.href = `/exam_dashboard?subject=${encodeURIComponent(subject)}`;
    });
  }

});
