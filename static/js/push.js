/* ======================================================================
   EMIS PUSH — push.js (v4 FINAL 2025)
   Handles:
     • Open push class modal
     • Class selection
     • Confirm push → /api/push
     • Clear per class
     • Push ALL subjects
     • Proper modal close/reset
====================================================================== */

(() => {
  window.EmisPush = {
    selectedClass: null,

    init() {
      const btnPush    = document.querySelector("#pushSelectedToPortal");
      const btnClear   = document.querySelector("#clearPortalSubjects");
      const btnPushAll = document.querySelector("#btnPushAllSubjects");

      const modalPush  = document.querySelector("#pushClassModal");
      const modalClear = document.querySelector("#clearPortalModal");
      const confirmPush = document.querySelector("#btnConfirmPush");

      if (!btnPush || !modalPush || !confirmPush) return;

      const pushClassBtns  = modalPush.querySelectorAll(".class-btn");
      const clearClassBtns = modalClear?.querySelectorAll(".clear-btn");
      const logBody = document.querySelector("#portalLogBody");

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

      const closeClearModal = () => {
        if (modalClear) modalClear.classList.add("hidden");
      };

      /* CLOSE BUTTONS */
      modalPush.querySelectorAll('[data-close="true"]').forEach((el) => {
        el.onclick = closePushModal;
      });
      modalClear?.querySelectorAll('[data-close="true"]').forEach((el) => {
        el.onclick = closeClearModal;
      });

      /* OPEN PUSH MODAL */
      btnPush.onclick = () => {
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

      /* CONFIRM PUSH */
      confirmPush.onclick = async () => {
        const files = [...EmisUploads.selectedFiles];
        const cls = this.selectedClass;

        closePushModal();

        const res = await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files, class_category: cls }),
        });

        const out = await res.json();

        if (!out.success) {
          flashMessage("Push failed", "error");
          return;
        }

        flashMessage(`Pushed to ${cls}: ${out.files_pushed.length} file(s).`);
        log(`🚀 Pushed ${out.files_pushed.length} file(s) to ${cls}`);

        EmisUploads.selectedFiles.clear();

        if (window.updatePushCount) updatePushCount();
        else if (window.EmisUploads?.updatePushCount) EmisUploads.updatePushCount();
      };

      /* CLEAR SUBJECTS */
      btnClear.onclick = () => modalClear.classList.remove("hidden");

      clearClassBtns?.forEach((btn) => {
        btn.onclick = async () => {
          const cls = btn.dataset.class;
          closeClearModal();

          const res = await fetch("/api/clear", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ class_category: cls }),
          });

          const out = await res.json();

          flashMessage(`Cleared: ${cls}`, "success");
          log(`🗑 Cleared subjects for ${cls}`);
        };
      });

      /* PUSH ALL */
      if (btnPushAll) {
        btnPushAll.onclick = () => {
          const list = EmisUploads.convertedItems.map((x) => x.filename);
          if (!list.length) {
            flashMessage("No subjects found.", "error");
            return;
          }
          modalPush.classList.remove("hidden");
          flashMessage("Select a class to push ALL subjects", "info");
        };
      }
    },
  };
})();
