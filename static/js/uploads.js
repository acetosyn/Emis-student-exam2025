/* ==========================================================
   EMIS UPLOADS — uploads.js (v7, backend-integrated)
   Works when uploads.html is injected dynamically.
   Safely re-initializes with guards.
========================================================== */

(() => {
  // Prevent duplicate init if the script is included more than once
  if (window.__EMIS_UPLOADS_BOUND__) return;
  window.__EMIS_UPLOADS_BOUND__ = true;

  // Expose a re-init that the page router can call after HTML injection
  window.EmisUploads = {
    initOnce(container = document) {
      const root = container.querySelector(".uploads-wrapper");
      if (!root || root.__initialized__) return;
      root.__initialized__ = true;

      // ---------- Elements ----------
      const dropZone       = root.querySelector("#uploadDropZone");
      const inputSingle    = root.querySelector("#uploadInputSingle");
      const inputMulti     = root.querySelector("#uploadInputMulti");
      const chooseSingle   = root.querySelector("#chooseSingle");
      const chooseMulti    = root.querySelector("#chooseMulti");
      const fileList       = root.querySelector("#fileList");
      const filePreview    = root.querySelector("#filePreview");
      const startUpload    = root.querySelector("#startUpload");
      const clearUploads   = root.querySelector("#clearUploads");
      const progress       = root.querySelector("#uploadProgress");
      const bar            = progress ? progress.querySelector(".progress-bar") : null;

      const tableBody      = root.querySelector("#uploadedTable");
      const searchBox      = root.querySelector("#searchUploads");
      const pushBtn        = root.querySelector("#pushToPortal");
      const jsonBtn        = root.querySelector("#viewPortalJSON");
      const portalLog      = root.querySelector("#portalLog");
      const pushCountEl    = root.querySelector("#pushCount");

      const modal          = document.getElementById("jsonModal");
      const modalTitle     = document.getElementById("jsonModalTitle");
      const modalBody      = document.getElementById("jsonModalBody");

      // ---------- State ----------
      let stagedFiles = [];           // Files selected/dragged before upload
      let convertedItems = [];        // Rows from backend /api/uploads

      // ---------- Helpers ----------
      const showProgress = (on) => {
        if (!progress) return;
        progress.classList.toggle("hidden", !on);
      };

      const setBar = (v) => { if (bar) bar.style.width = `${v}%`; };

      const niceKB = (bytes) => Math.round((bytes / 1024) * 10) / 10;

      const openModal = (title, content) => {
        modalTitle.textContent = title;
        modalBody.textContent = content; // pre tag -> keep formatting
        modal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
      };

      const closeModal = () => {
        modal.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
        modalBody.textContent = "";
      };

      modal?.addEventListener("click", (e) => {
        if (e.target.dataset.close === "true") closeModal();
      });

      // ---------- File selection ----------
      chooseSingle?.addEventListener("click", (e) => {
        e.preventDefault();
        inputSingle?.click();
      });
      chooseMulti?.addEventListener("click", (e) => {
        e.preventDefault();
        inputMulti?.click();
      });

      inputSingle?.addEventListener("change", (e) => {
        if (!e.target.files?.length) return;
        stagedFiles = [e.target.files[0]];
        renderStaged();
      });
      inputMulti?.addEventListener("change", (e) => {
        if (!e.target.files?.length) return;
        stagedFiles = Array.from(e.target.files);
        renderStaged();
      });

      // Drag & drop
      dropZone?.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
      });
      dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
      dropZone?.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (!e.dataTransfer?.files?.length) return;
        stagedFiles = Array.from(e.dataTransfer.files);
        renderStaged();
      });

      function renderStaged() {
        // list
        fileList.innerHTML = "";
        if (!stagedFiles.length) {
          fileList.innerHTML = `<li class="empty">No files selected</li>`;
        } else {
          stagedFiles.forEach((f) => {
            const li = document.createElement("li");
            li.innerHTML = `<i class="fa-solid fa-file"></i> ${f.name}
              <span>${niceKB(f.size)} KB</span>`;
            fileList.appendChild(li);
          });
        }
        // tiny preview cards
        filePreview.innerHTML = "";
        stagedFiles.forEach((file) => {
          const card = document.createElement("div");
          card.className = "preview-card";
          const name = document.createElement("p");
          name.textContent = file.name;

          // Only show icon (no heavy previews needed)
          const icon = document.createElement("i");
          icon.className = "fa-solid fa-file-lines generic-icon";
          if (file.type === "application/pdf") icon.className = "fa-solid fa-file-pdf pdf-icon";
          card.appendChild(icon);
          card.appendChild(name);
          filePreview.appendChild(card);
        });
      }

      clearUploads?.addEventListener("click", () => {
        stagedFiles = [];
        renderStaged();
      });

      // ---------- Upload to backend (/api/upload) ----------
      startUpload?.addEventListener("click", async () => {
        if (!stagedFiles.length) {
          alert("Please select at least one file.");
          return;
        }
        try {
          showProgress(true);
          setBar(5);

          const fd = new FormData();
          stagedFiles.forEach((f) => fd.append("file", f));

          // Simulate ramp
          setBar(30);

          const res = await fetch("/api/upload", { method: "POST", body: fd });
          setBar(70);

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Upload failed (${res.status})`);
          }

          const data = await res.json();
          setBar(95);

          // Refresh table from backend
          await fetchConverted();

          // Reset staged
          stagedFiles = [];
          renderStaged();
          setBar(100);
        } catch (e) {
          console.error(e);
          alert(`Upload error: ${e.message}`);
        } finally {
          setTimeout(() => {
            showProgress(false);
            setBar(0);
          }, 350);
        }
      });

      // ---------- Backend reads ----------
      async function fetchConverted() {
        try {
          const res = await fetch("/api/uploads");
          if (!res.ok) throw new Error(`List failed (${res.status})`);
          const data = await res.json();
          convertedItems = Array.isArray(data.uploads) ? data.uploads : data;
          renderTable();
        } catch (e) {
          console.error("List error:", e);
          tableBody.innerHTML = `<tr><td colspan="5" class="empty">Could not load uploads</td></tr>`;
        }
      }

      function renderTable() {
        tableBody.innerHTML = "";
        const rows = convertedItems.map((it) => {
          const name = it.filename || it.name || "";
          const size = typeof it.size_kb === "number" ? it.size_kb : (it.size ? niceKB(it.size) : "");
          const items = it.count || it.items || ""; // optional count if you add it later
          return `
            <tr data-filename="${name}">
              <td class="truncate">${name}</td>
              <td class="center">${items || "-"}</td>
              <td class="center">${size || "-"}</td>
              <td><span class="status success">Ready</span></td>
              <td class="actions">
                <button class="btn-secondary xsm act-preview" title="Quick preview"><i class="fa-solid fa-eye"></i> Preview</button>
                <button class="btn-primary xsm act-view" title="View full JSON"><i class="fa-solid fa-magnifying-glass-plus"></i> View</button>
                <button class="btn-secondary xsm act-delete" title="Delete"><i class="fa-solid fa-trash"></i> Delete</button>
              </td>
            </tr>
          `;
        });

        if (!rows.length) {
          tableBody.innerHTML = `<tr><td colspan="5" class="empty">No uploads yet</td></tr>`;
        } else {
          tableBody.innerHTML = rows.join("");
        }

        pushCountEl.textContent = convertedItems.length;
      }

      // ---------- Actions (delegated) ----------
      tableBody?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const tr = e.target.closest("tr");
        const filename = tr?.dataset?.filename;
        if (!filename) return;

        if (btn.classList.contains("act-view")) {
          // Full content
          try {
            const res = await fetch(`/api/uploads/${encodeURIComponent(filename)}`);
            if (!res.ok) throw new Error(`View failed (${res.status})`);
            const data = await res.json();

            // If backend returns {"filename":..., "questions":[...]} (our uploads.py),
            // pretty print with some context
            const printable = JSON.stringify(data, null, 2);
            openModal(`View: ${filename}`, printable);
          } catch (err) {
            alert(`Unable to load ${filename}: ${err.message}`);
          }
        }

        if (btn.classList.contains("act-preview")) {
          // Show first ~5 questions quickly
          try {
            const res = await fetch(`/api/uploads/${encodeURIComponent(filename)}`);
            if (!res.ok) throw new Error(`Preview failed (${res.status})`);
            const data = await res.json();

            let questions = data.questions || data; // backend might return array directly
            if (!Array.isArray(questions)) {
              // Sometimes biology.json format is an object with fields; normalize
              if (Array.isArray(data)) questions = data;
              else if (Array.isArray(data.questions)) questions = data.questions;
              else questions = [];
            }

            const head = questions.slice(0, 5);
            const printable = JSON.stringify(head, null, 2);
            openModal(`Preview: ${filename} (first ${head.length})`, printable);
          } catch (err) {
            alert(`Unable to preview ${filename}: ${err.message}`);
          }
        }

        if (btn.classList.contains("act-delete")) {
          if (!confirm(`Delete ${filename}?`)) return;
          try {
            const res = await fetch(`/api/uploads/${encodeURIComponent(filename)}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`Delete failed (${res.status})`);
            await fetchConverted();
          } catch (err) {
            alert(`Unable to delete ${filename}: ${err.message}`);
          }
        }
      });

      // ---------- Search ----------
      searchBox?.addEventListener("input", () => {
        const q = searchBox.value.trim().toLowerCase();
        const rows = tableBody.querySelectorAll("tr");
        rows.forEach((r) => {
          const name = (r.dataset.filename || "").toLowerCase();
          r.style.display = name.includes(q) || r.classList.contains("empty") ? "" : "none";
        });
      });

      // ---------- Push + JSON preview (placeholder for later integration) ----------
      pushBtn?.addEventListener("click", () => {
        if (!convertedItems.length) return alert("No converted files to push.");
        portalLog.innerHTML += `<p>✅ Queued ${convertedItems.length} item(s) for portal push (integration pending).</p>`;
      });

      jsonBtn?.addEventListener("click", async () => {
        if (!convertedItems.length) {
          portalLog.innerHTML = `<p>No items to preview.</p>`;
          return;
        }
        // Show just the filenames for now
        const list = convertedItems.map((x) => x.filename || x.name).filter(Boolean);
        portalLog.innerHTML = `<pre>${JSON.stringify(list, null, 2)}</pre>`;
      });

      // ---------- Initial load ----------
      renderStaged();
      fetchConverted();
    },
  };

  // Auto-init whenever uploads.html gets injected
  const autoInitObserver = new MutationObserver(() => {
    const wrapper = document.querySelector(".uploads-wrapper");
    if (wrapper) window.EmisUploads.initOnce(document);
  });
  autoInitObserver.observe(document.body, { childList: true, subtree: true });

  // If the page is already there (direct navigation)
  if (document.readyState === "complete" || document.readyState === "interactive") {
    const wrapper = document.querySelector(".uploads-wrapper");
    if (wrapper) window.EmisUploads.initOnce(document);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      const wrapper = document.querySelector(".uploads-wrapper");
      if (wrapper) window.EmisUploads.initOnce(document);
    });
  }
})();
