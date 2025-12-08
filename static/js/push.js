/* ======================================================================
   EMIS PUSH — push.js (v11 FINAL 2025 — MATCHED TO FINAL push.py)
   FIXES:
     ✓ Do NOT send year separately (backend extracts from "year:filename")
     ✓ Payload = { files, class_category }
====================================================================== */

(() => {
  window.EmisPush = {
    selectedClass: null,

    init() {
      const btnPush       = document.querySelector("#pushSelectedToPortal");
      const btnClear      = document.querySelector("#clearPortalSubjects");
      const btnPushAll    = document.querySelector("#btnPushAllSubjects");
      const modalPush     = document.querySelector("#pushClassModal");
      const modalClear    = document.querySelector("#clearPortalModal");
      const confirmPush   = document.querySelector("#btnConfirmPush");
      const pushYearSel   = document.querySelector("#pushYearSelector");
      const logBody       = document.querySelector("#portalLogBody");

      if (!btnPush || !modalPush || !confirmPush || !pushYearSel) return;

      const pushClassBtns  = modalPush.querySelectorAll(".class-btn");
      const clearClassBtns = modalClear?.querySelectorAll(".clear-btn");

      /* LOG HELPER */
      const log = (msg) => {
        if (!logBody) return;
        const placeholder = logBody.querySelector(".log-placeholder");
        if (placeholder) logBody.innerHTML = "";
        const p = document.createElement("p");
        p.textContent = msg;
        logBody.appendChild(p);
        logBody.scrollTop = logBody.scrollHeight;
      };

      /* RESET MODAL */
      const resetPushModal = () => {
        this.selectedClass = null;
        confirmPush.disabled = true;
        confirmPush.classList.add("disabled");

        const chosen = modalPush.querySelector("#chosenPushClass");
        chosen.textContent = "";
        chosen.classList.add("hidden");
      };

      const closePushModal = () => {
        modalPush.classList.add("hidden");
        resetPushModal();
      };

      const closeClearModal = () => modalClear?.classList.add("hidden");

      /* CLOSE BUTTONS */
      modalPush.querySelectorAll('[data-close="true"]').forEach((el) => {
        el.onclick = closePushModal;
      });
      modalClear?.querySelectorAll('[data-close="true"]').forEach((el) => {
        el.onclick = closeClearModal;
      });

      /* OPEN PUSH MODAL */
      btnPush.onclick = () => {
        const year = pushYearSel.value;
        if (!year || year === "Select Year") {
          flashMessage("Select a year first.", "error");
          return;
        }

        if (!EmisUploads.selectedFiles.size) {
          flashMessage("No files selected.", "error");
          return;
        }
        modalPush.classList.remove("hidden");
      };

      /* SELECT CLASS */
      pushClassBtns.forEach((btn) => {
        btn.onclick = () => {
          this.selectedClass = btn.dataset.class;
          confirmPush.disabled = false;
          confirmPush.classList.remove("disabled");

          const chosen = modalPush.querySelector("#chosenPushClass");
          chosen.textContent = `Selected Class: ${this.selectedClass}`;
          chosen.classList.remove("hidden");
        };
      });

      /* CONFIRM PUSH — FINAL FIX */
      confirmPush.onclick = async () => {
        const files = [...EmisUploads.selectedFiles];  // ALREADY contains "year:filename"
        const cls   = this.selectedClass;

        closePushModal();

        const res = await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files,              // YEAR embedded inside strings — correct
            class_category: cls // only class is needed
          }),
        });

        const out = await res.json();

        if (!out.success) {
          flashMessage("Push failed", "error");
          return;
        }

        flashMessage(`Pushed ${out.subjects_pushed.length} subject(s) to ${cls}.`);
        log(`🚀 Pushed ${out.subjects_pushed.length} subject(s) → ${cls}`);

        EmisUploads.selectedFiles.clear();
        if (window.updatePushCount) updatePushCount();
        else if (window.EmisUploads?.updatePushCount) EmisUploads.updatePushCount();
      };

      /* OPEN CLEAR MODAL */
      btnClear.onclick = () => {
        const year = pushYearSel.value;
        if (!year || year === "Select Year") {
          flashMessage("Select a year first.", "error");
          return;
        }
        modalClear.classList.remove("hidden");
      };

      /* CLEAR SUBJECTS */
      clearClassBtns?.forEach((btn) => {
        btn.onclick = async () => {
          const cls  = btn.dataset.class;
          const year = pushYearSel.value;

          closeClearModal();

          const res = await fetch("/api/clear", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              year,
              class_category: cls,
            }),
          });

          const out = await res.json();
          flashMessage(`Cleared: ${year} → ${cls}`, "success");
          log(`🗑 Cleared ${cls} subjects for ${year}`);
        };
      });

      /* PUSH ALL */
      if (btnPushAll) {
        btnPushAll.onclick = () => {
          const year = pushYearSel.value;

          if (!year || year === "Select Year") {
            flashMessage("Select a year first.", "error");
            return;
          }

          if (!EmisUploads.convertedItems.length) {
            flashMessage("No subjects found for this year.", "error");
            return;
          }

          modalPush.classList.remove("hidden");
          flashMessage("Select a class to push ALL subjects.", "info");

          // NOW correctly embeds year into each filename
          EmisUploads.selectedFiles.clear();
          EmisUploads.convertedItems.forEach((it) => {
            EmisUploads.selectedFiles.add(`${year}:${it.filename}`);
          });

          if (window.updatePushCount) updatePushCount();
        };
      }
    },
  };
})();
