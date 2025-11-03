/* =============================================================
   EMIS UPLOADS SCRIPT — uploads.js
   Handles: file drag-drop, upload simulation, progress,
   dashboard rendering, and push-to-portal simulation.
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const uploadInput = document.getElementById("uploadInput");
  const chooseFiles = document.getElementById("chooseFiles");
  const fileList = document.getElementById("fileList");
  const startUpload = document.getElementById("startUpload");
  const clearUploads = document.getElementById("clearUploads");
  const progress = document.getElementById("uploadProgress");
  const bar = progress.querySelector(".progress-bar");
  const tableBody = document.getElementById("uploadedTable");
  const pushBtn = document.getElementById("pushToPortal");
  const jsonBtn = document.getElementById("viewPortalJSON");
  const portalLog = document.getElementById("portalLog");
  const pushCount = document.getElementById("pushCount");
  const dropZone = document.getElementById("uploadDropZone");

  let files = [];
  let uploadedItems = [];

  /* -------------------------------------------
     FILE SELECTION
  ------------------------------------------- */
  chooseFiles.addEventListener("click", () => uploadInput.click());

  uploadInput.addEventListener("change", (e) => {
    files = [...e.target.files];
    renderFileList();
  });

  // Drag and drop handlers
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    files = [...e.dataTransfer.files];
    renderFileList();
  });

  function renderFileList() {
    fileList.innerHTML = "";
    if (!files.length) {
      fileList.innerHTML = `<li class="empty">No files selected</li>`;
      return;
    }
    files.forEach((file) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <i class="fa-solid fa-file"></i> ${file.name}
        <span>${(file.size / 1024).toFixed(1)} KB</span>
      `;
      fileList.appendChild(li);
    });
  }

  /* -------------------------------------------
     UPLOAD SIMULATION / PROGRESS
  ------------------------------------------- */
  startUpload.addEventListener("click", () => {
    if (!files.length) return alert("Please select at least one file!");
    progress.classList.remove("hidden");

    let width = 0;
    const interval = setInterval(() => {
      width += 10;
      bar.style.width = width + "%";
      if (width >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          progress.classList.add("hidden");
          bar.style.width = "0";
          appendToDashboard();
          files = [];
          fileList.innerHTML = "";
        }, 500);
      }
    }, 150);
  });

  clearUploads.addEventListener("click", () => {
    files = [];
    fileList.innerHTML = `<li class="empty">No files selected</li>`;
  });

  /* -------------------------------------------
     DASHBOARD / TABLE
  ------------------------------------------- */
  function appendToDashboard() {
    const now = new Date().toLocaleDateString();
    files.forEach((file) => {
      uploadedItems.push({
        title: file.name,
        subject: "Auto-detect",
        date: now,
        status: "Uploaded",
      });
    });
    updateDashboard();
  }

  function updateDashboard() {
    tableBody.innerHTML = "";
    if (!uploadedItems.length) {
      tableBody.innerHTML = `<tr><td colspan="5" class="empty">No uploads yet</td></tr>`;
      return;
    }

    uploadedItems.forEach((item, i) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.title}</td>
        <td>${item.subject}</td>
        <td>${item.date}</td>
        <td><span class="status">${item.status}</span></td>
        <td><button class="btn-secondary small" data-id="${i}">View</button></td>
      `;
      tableBody.appendChild(row);
    });

    pushCount.textContent = uploadedItems.length;
  }

  /* -------------------------------------------
     PUSH TO PORTAL (SIMULATION)
  ------------------------------------------- */
  pushBtn.addEventListener("click", () => {
    if (!uploadedItems.length)
      return alert("No uploaded files to push!");
    const jsonData = JSON.stringify(uploadedItems, null, 2);
    portalLog.innerHTML += `<p>✅ ${uploadedItems.length} file(s) converted and pushed to student database.</p>`;
    console.log("PUSHED JSON:", jsonData);
  });

  jsonBtn.addEventListener("click", () => {
    if (!uploadedItems.length)
      return alert("Nothing to preview!");
    portalLog.innerHTML = `<pre>${JSON.stringify(uploadedItems, null, 2)}</pre>`;
  });
});
