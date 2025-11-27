/* ==========================================================
   EMIS UPLOADS — uploads.js (v14, PUSH REMOVED)
   Handles:
     • Upload DOCX/JSON → /api/upload
     • Overwrite detection
     • Overwrite / Skip modal
     • Staging files
     • Rendering converted table
     • Selection queue (no push here)
     • Preview JSON
     • Refresh table
   ========================================================== */

/* ==========================================================
   FLASH MESSAGE
========================================================== */
function flashMessage(text, type = "success") {
  const fm = document.getElementById("flashMessage");
  if (!fm) return;
  fm.textContent = text;
  fm.className = `flash-message ${type} show`;
  setTimeout(() => fm.classList.remove("show"), 3000);
}

/* ==========================================================
   OVERWRITE MODAL
========================================================== */
function showOverwriteModal(item, onOverwrite, onSkip) {
  let modal = document.getElementById("overwriteModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "overwriteModal";
    modal.className = "overwrite-modal";

    modal.innerHTML = `
      <div class="ov-content">
        <h3>Subject Already Exists</h3>
        <p>
          <strong>${item.subject}</strong> (${item.class_category}) already has a JSON file.<br>
          Do you want to overwrite it?
        </p>

        <div class="ov-buttons">
          <button id="ovOverwrite" class="btn-danger">Overwrite</button>
          <button id="ovSkip" class="btn-secondary">Skip</button>
        </div>
      </div>
    `;

    const css = document.createElement("style");
    css.textContent = `
      .overwrite-modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.55);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      }
      .ov-content {
        background: white;
        padding: 1.3rem;
        width: 350px;
        border-radius: 10px;
        text-align: center;
      }
      .ov-buttons { margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; }
      .btn-danger { background:#dc2626;color:white;padding:.5rem 1rem;border-radius:6px;}
      .btn-secondary { background:#e5e7eb;padding:.5rem 1rem;border-radius:6px;}
    `;
    document.head.appendChild(css);
    document.body.appendChild(modal);
  }

  modal.style.display = "flex";
  document.getElementById("ovOverwrite").onclick = () => {
    modal.style.display = "none";
    onOverwrite();
  };
  document.getElementById("ovSkip").onclick = () => {
    modal.style.display = "none";
    onSkip();
  };
}

/* ==========================================================
   UPLOAD MODULE
========================================================== */
(() => {
  if (window.__EMIS_UPLOADS_BOUND__) return;
  window.__EMIS_UPLOADS_BOUND__ = true;

  window.EmisUploads = {
    selectedFiles: new Set(),
    convertedItems: [],

    getMeta(fname) {
      return this.convertedItems.find((i) => i.filename === fname);
    },

    queueFromPreview(fname) {
      this.selectedFiles.add(fname);
      updateSelectionBadge();
    },

    initOnce(container = document) {
      const root = container.querySelector(".uploads-wrapper");
      if (!root || root.__initialized__) return;
      root.__initialized__ = true;

      /* ------------------------------------------------------
         ELEMENTS
      ------------------------------------------------------ */
      const dropZone = root.querySelector("#uploadDropZone");
      const inputSingle = root.querySelector("#uploadInputSingle");
      const inputMulti = root.querySelector("#uploadInputMulti");
      const chooseSingle = root.querySelector("#chooseSingle");
      const chooseMulti = root.querySelector("#chooseMulti");
      const fileList = root.querySelector("#fileList");
      const selectedCount = root.querySelector("#selectedCount");

      const startUpload = root.querySelector("#startUpload");
      const clearUploads = root.querySelector("#clearUploads");

      const uploadProgress = root.querySelector("#uploadProgress");
      const uploadProgressBar = root.querySelector("#uploadProgressBar");
      const uploadProgressLabel = root.querySelector("#uploadProgressLabel");

      const tableBody = root.querySelector("#uploadedTable");
      const searchBox = root.querySelector("#searchUploads");
      const refreshBtn = root.querySelector("#refreshUploads");

      const btnViewSubjects = root.querySelector("#btnViewSubjects");

      let stagedFiles = [];

      /* ------------------------------------------------------
         UTILITIES
      ------------------------------------------------------ */
      const niceKB = (b) => Math.round((b / 1024) * 10) / 10;

      const showProgress = (on, msg = "Converting…") => {
        uploadProgress.classList.toggle("hidden", !on);
        uploadProgressLabel.textContent = msg;
      };

      const setProgress = (v) => (uploadProgressBar.style.width = `${v}%`);

      const updateSelectionBadge = () => {
        selectedCount.textContent = `${stagedFiles.length} selected`;
      };

      /* ------------------------------------------------------
         STAGING FILES
      ------------------------------------------------------ */
      const renderStaged = () => {
        fileList.innerHTML = "";
        if (!stagedFiles.length) {
          fileList.innerHTML = `<li class="empty">No files selected</li>`;
          updateSelectionBadge();
          return;
        }

        stagedFiles.forEach((f) => {
          fileList.innerHTML += `
            <li>
              <i class="fa-solid fa-file"></i>
              <span class="file-name">${f.name}</span>
              <span class="file-size">${niceKB(f.size)} KB</span>
            </li>
          `;
        });

        updateSelectionBadge();
      };

      chooseSingle.onclick = () => inputSingle.click();
      chooseMulti.onclick = () => inputMulti.click();

      inputSingle.onchange = (e) => {
        stagedFiles = [...e.target.files];
        renderStaged();
      };
      inputMulti.onchange = (e) => {
        stagedFiles = [...e.target.files];
        renderStaged();
      };

      /* Drag & Drop */
      dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
      };
      dropZone.ondragleave = () => dropZone.classList.remove("drag-over");
      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        stagedFiles = [...e.dataTransfer.files];
        renderStaged();
      };

      clearUploads.onclick = () => {
        stagedFiles = [];
        renderStaged();
      };

      /* ------------------------------------------------------
         LOADER FOR UPLOAD
      ------------------------------------------------------ */
      const normalBtnHTML = startUpload.innerHTML;

      const showLoading = (txt = "Converting…") => {
        startUpload.disabled = true;
        startUpload.innerHTML = `<span class="spinner"></span>${txt}`;
        startUpload.classList.add("loading");
      };

      const hideLoading = () => {
        startUpload.disabled = false;
        startUpload.innerHTML = normalBtnHTML;
        startUpload.classList.remove("loading");
      };

      const cssSpin = document.createElement("style");
      cssSpin.textContent = `
        .spinner {
          width: 18px; height: 18px;
          border: 3px solid white;
          border-top-color: transparent;
          border-radius: 50%;
          display: inline-block;
          margin-right: 8px;
          animation: spin .6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        button.loading { opacity: .7; pointer-events: none; }
      `;
      document.head.appendChild(cssSpin);

      /* ------------------------------------------------------
         BEGIN UPLOAD
      ------------------------------------------------------ */
      startUpload.onclick = async () => {
        if (!stagedFiles.length) return alert("No files selected.");

        try {
          showLoading();
          showProgress(true);
          setProgress(25);

          const fd = new FormData();
          stagedFiles.forEach((f) => fd.append("file", f));

          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) throw new Error("Upload failed");

          setProgress(55);

          const payload = await res.json();
          setProgress(85);

          /* Handle overwrite scenario */
          const existsItems = payload.converted.filter((i) => i.status === "exists");
          if (existsItems.length) {
            hideLoading();
            showProgress(false);

            const item = existsItems[0];

            showOverwriteModal(
              item,
              async () => {
                const fd2 = new FormData();
                stagedFiles.forEach((f) => fd2.append("file", f));
                fd2.append("overwrite", "true");

                showLoading("Overwriting…");
                await fetch("/api/upload", { method: "POST", body: fd2 });
                await fetchConverted();
                hideLoading();
                flashMessage("Subject overwritten successfully.");
              },
              () => flashMessage("Skipped overwrite.", "error")
            );
            return;
          }

          /* Normal success */
          await fetchConverted();
          stagedFiles = [];
          renderStaged();
          setProgress(100);
          flashMessage("Conversion completed.");

        } catch (err) {
          alert(err.message);
        } finally {
          setTimeout(() => showProgress(false), 300);
          hideLoading();
          setProgress(0);
        }
      };

      /* ------------------------------------------------------
         TABLE LOADING
      ------------------------------------------------------ */
      async function fetchConverted(showRefresh = false) {
        try {
          if (showRefresh) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `<span class="spinner"></span>`;
          }

          const res = await fetch("/api/uploads");
          const data = await res.json();

          EmisUploads.convertedItems = data.uploads || data;
          renderTable();

          if (showRefresh) {
            setTimeout(() => {
              refreshBtn.disabled = false;
              refreshBtn.innerHTML = `<i class="fa-solid fa-rotate"></i>`;
            }, 300);
          }
        } catch {
          tableBody.innerHTML = `<tr><td colspan="4" class="empty">Failed to load.</td></tr>`;
        }
      }

      refreshBtn.onclick = () => fetchConverted(true);

      /* ------------------------------------------------------
         RENDER TABLE
      ------------------------------------------------------ */
      function renderTable() {
        tableBody.innerHTML = "";

        if (!EmisUploads.convertedItems.length) {
          tableBody.innerHTML = `
            <tr><td colspan="7" class="empty">No converted exams yet.</td></tr>`;
          return;
        }

        tableBody.innerHTML = EmisUploads.convertedItems
          .map(
            (item) => `
            <tr class="upload-row" data-filename="${item.filename}">
              <td>
                <input type="checkbox" class="row-select"
                  ${EmisUploads.selectedFiles.has(item.filename) ? "checked" : ""}>
              </td>

              <td class="file-cell" data-clickable="true">
                <div class="file-main">
                  <span class="file-name">${item.filename}</span>
                  <span class="file-meta">${item.subject} • ${item.class_category} • ${item.questions} questions</span>
                </div>
              </td>

              <td>${item.subject}</td>
              <td class="center">${item.questions}</td>
            </tr>`
          )
          .join("");
      }

      /* ------------------------------------------------------
         ROW ACTIONS: SELECT + PREVIEW
      ------------------------------------------------------ */
      tableBody.onclick = async (e) => {
        const row = e.target.closest("tr.upload-row");
        if (!row) return;
        const fname = row.dataset.filename;

        /* CASE 1 — CHECKBOX toggle */
        if (e.target.classList.contains("row-select")) {
          if (e.target.checked) EmisUploads.selectedFiles.add(fname);
          else EmisUploads.selectedFiles.delete(fname);
          return;
        }

        /* CASE 2 — CLICK filename → preview JSON */
        if (e.target.closest("[data-clickable='true']")) {
          try {
            const res = await fetch(`/api/uploads/${fname}`);
            const json = await res.json();
            const meta = EmisUploads.getMeta(fname);

            ConvertUI.setPreviewCard(fname, meta, json);
            ConvertUI.openJsonModal(`Preview: ${fname}`, JSON.stringify(json, null, 2));
          } catch {
            alert("Preview failed.");
          }
        }
      };

      /* ------------------------------------------------------
         SEARCH
      ------------------------------------------------------ */
      searchBox.oninput = () => {
        const q = searchBox.value.toLowerCase();
        const rows = tableBody.querySelectorAll("tr.upload-row");

        rows.forEach((r) => {
          const name = r.dataset.filename.toLowerCase();
          r.style.display = name.includes(q) ? "" : "none";
        });
      };

      /* INIT */
      renderStaged();
      fetchConverted();
    },
  };

  /* AUTO INIT */
  const autoInit = () => {
    const wrap = document.querySelector(".uploads-wrapper");
    if (wrap) window.EmisUploads.initOnce(document);
  };

  if (["complete", "interactive"].includes(document.readyState)) autoInit();
  else document.addEventListener("DOMContentLoaded", autoInit);

  new MutationObserver(autoInit).observe(document.body, { childList: true, subtree: true });
})();
