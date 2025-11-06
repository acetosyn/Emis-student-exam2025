/* ==========================================================
   EMIS ID MANAGEMENT — ids.js (v6.0)
   ----------------------------------------------------------
   Handles:
   ✅ Supabase (Students)
   ✅ Flask Backend (Teachers)
   ✅ Modal Options (Generate One / Multiple)
   ✅ CSV Export, Search, and Render Logic
========================================================== */

document.addEventListener("DOMContentLoaded", async () => {

  // -------------------------------
  // INIT SUPABASE (for students)
  // -------------------------------
  const supabaseUrl = "https://YOUR_SUPABASE_URL.supabase.co";
  const supabaseKey = "YOUR_SUPABASE_ANON_KEY";
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  // -------------------------------
  // ELEMENTS
  // -------------------------------
  const studentTableBody = document.getElementById("studentTableBody");
  const teacherTableBody = document.getElementById("teacherTableBody");
  const studentSection = document.getElementById("studentSection");
  const teacherSection = document.getElementById("teacherSection");
  const viewSelector = document.getElementById("viewSelector");
  const searchBox = document.getElementById("searchBox");
  const exportBtn = document.getElementById("exportCSVBtn");

  // teacher id modals
  const teacherOptionsModal = document.getElementById("teacherOptionsModal");
  const closeTeacherOptionsModal = document.getElementById("closeTeacherOptionsModal");
  const generateOneTeacherBtn = document.getElementById("generateOneTeacherBtn");
  const openGenerateMultipleBtn = document.getElementById("openGenerateMultipleBtn");

  const generateTeacherBtn = document.getElementById("generateTeacherBtn");
  const generateModal = document.getElementById("generateTeacherModal");
  const cancelGenerateBtn = document.getElementById("cancelGenerateBtn");
  const closeGenerateModal = document.getElementById("closeGenerateModal");
  const generateForm = document.getElementById("generateTeacherForm");

  const teacherIdModal = document.getElementById("teacherIdModal");
  const closeTeacherIdModal = document.getElementById("closeTeacherIdModal");
  const viewTeacherIdsBtn = document.getElementById("viewTeacherIdsBtn");
  const viewTeacherIdsTile = document.getElementById("viewTeacherIds");
  const teacherIdResults = document.getElementById("teacherIdResults");
  const downloadTeacherCSV = document.getElementById("downloadTeacherCSV");
  const refreshTeacherList = document.getElementById("refreshTeacherList");

  // -------------------------------
  // STUDENTS — SUPABASE
  // -------------------------------
  async function loadStudents() {
    try {
      const { data, error } = await supabase.from("students").select("*").order("student_id");
      if (error) throw error;
      renderStudents(data);
      document.getElementById("totalStudents").textContent = data.length;
    } catch (err) {
      console.error("❌ Error loading students:", err);
    }
  }

  function renderStudents(students) {
    studentTableBody.innerHTML = "";
    students.forEach(st => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${st.student_id}</td>
        <td>${st.full_name}</td>
        <td>${st.class || "--"}</td>
        <td>${new Date(st.created_at).toLocaleDateString()}</td>
      `;
      studentTableBody.appendChild(tr);
    });
  }

  // -------------------------------
  // TEACHERS — BACKEND (Flask)
  // -------------------------------
  async function loadTeachers() {
    try {
      const res = await fetch("/generate_teacher_ids");
      const data = await res.json();
      if (data.teachers) {
        renderTeachers(data.teachers);
        document.getElementById("totalTeachers").textContent = data.teachers.length;
      }
    } catch (err) {
      console.error("❌ Error loading teachers:", err);
    }
  }

  function renderTeachers(teachers) {
    teacherTableBody.innerHTML = "";
    teachers.forEach(tc => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${tc.teacher_id}</td>
        <td>${tc.password}</td>
        <td>${tc.status || "Active"}</td>
        <td>${new Date(tc.created_at).toLocaleDateString()}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn action-suspend" data-id="${tc.id}">
              <i class="fa-solid fa-ban"></i>
            </button>
            <button class="action-btn action-delete" data-id="${tc.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      teacherTableBody.appendChild(tr);
    });
  }

  // -------------------------------
  // TOGGLE VIEW (Students / Teachers)
  // -------------------------------
  viewSelector.addEventListener("change", () => {
    if (viewSelector.value === "students") {
      teacherSection.classList.add("hidden");
      studentSection.classList.remove("hidden");
    } else {
      studentSection.classList.add("hidden");
      teacherSection.classList.remove("hidden");
    }
  });

  // -------------------------------
  // TEACHER ID TILE → OPTIONS MODAL
  // -------------------------------
  if (viewTeacherIdsTile) {
    viewTeacherIdsTile.addEventListener("click", () => {
      teacherOptionsModal.classList.remove("hidden");
    });
  }
  closeTeacherOptionsModal.addEventListener("click", () => teacherOptionsModal.classList.add("hidden"));

  // Generate One ID instantly
  generateOneTeacherBtn.addEventListener("click", async () => {
    try {
      const formData = new FormData();
      formData.append("count", 1);
      const res = await fetch("/generate_teacher_ids", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) return alert("❌ " + data.error);

      alert("✅ 1 Teacher ID created successfully!");
      renderTeachers(data.teachers);
      teacherOptionsModal.classList.add("hidden");
      showTeacherIdModal(data.generated);
    } catch (err) {
      console.error("Error generating single teacher ID:", err);
      alert("⚠️ Could not generate ID");
    }
  });

  // Open Multiple ID modal
  openGenerateMultipleBtn.addEventListener("click", () => {
    teacherOptionsModal.classList.add("hidden");
    generateModal.classList.remove("hidden");
  });

  // -------------------------------
  // GENERATE MULTIPLE TEACHER IDS
  // -------------------------------
  generateTeacherBtn.addEventListener("click", () => generateModal.classList.remove("hidden"));
  cancelGenerateBtn.addEventListener("click", () => generateModal.classList.add("hidden"));
  closeGenerateModal.addEventListener("click", () => generateModal.classList.add("hidden"));

  generateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const num = parseInt(document.getElementById("numTeachers").value);
    if (!num || num < 1) return alert("⚠️ Enter a valid number (1–100)");

    try {
      const formData = new FormData();
      formData.append("count", num);
      const res = await fetch("/generate_teacher_ids", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) return alert("❌ " + data.error);

      alert(`✅ ${data.generated.length} Teacher IDs created successfully!`);
      renderTeachers(data.teachers);
      document.getElementById("totalTeachers").textContent = data.teachers.length;
      generateModal.classList.add("hidden");
      showTeacherIdModal(data.generated);
    } catch (err) {
      console.error("Error generating multiple IDs:", err);
      alert("⚠️ Failed to generate IDs");
    }
  });

  // -------------------------------
  // VIEW TEACHER ID LIST
  // -------------------------------
  if (viewTeacherIdsBtn) {
    viewTeacherIdsBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("/generate_teacher_ids");
        const data = await res.json();
        showTeacherIdModal(data.teachers);
      } catch (err) {
        console.error("Error fetching teacher IDs:", err);
        alert("⚠️ Could not load teacher IDs");
      }
    });
  }

  closeTeacherIdModal.addEventListener("click", () => teacherIdModal.classList.add("hidden"));
  refreshTeacherList.addEventListener("click", async () => {
    await loadTeachers();
    alert("🔄 Teacher list refreshed.");
  });
  downloadTeacherCSV.addEventListener("click", () => window.location.href = "/export_teacher_ids");

  function showTeacherIdModal(list) {
    teacherIdResults.innerHTML = "";
    if (!list || !list.length) {
      teacherIdResults.innerHTML = `<p class="text-center text-gray-500">No teacher IDs found.</p>`;
    } else {
      list.forEach(tc => {
        const div = document.createElement("div");
        div.className = "p-2 bg-white rounded-lg shadow flex justify-between text-sm";
        div.innerHTML = `
          <span><b>${tc.teacher_id}</b> — ${tc.password}</span>
          <span class="text-xs text-gray-500">${tc.status || "Active"}</span>
        `;
        teacherIdResults.appendChild(div);
      });
    }
    teacherIdModal.classList.remove("hidden");
  }

  // -------------------------------
  // SEARCH & EXPORT
  // -------------------------------
  searchBox.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const rows = viewSelector.value === "students"
      ? studentTableBody.querySelectorAll("tr")
      : teacherTableBody.querySelectorAll("tr");
    rows.forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none";
    });
  });

  exportBtn.addEventListener("click", () => {
    const rows = Array.from(document.querySelectorAll("table tr"));
    const csv = rows.map(r => Array.from(r.children).map(td => td.innerText).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "EMIS_IDs.csv";
    a.click();
  });

  // -------------------------------
  // INITIAL LOAD
  // -------------------------------
  await loadStudents();
  await loadTeachers();
  document.getElementById("lastSync").textContent = new Date().toLocaleString();
});
