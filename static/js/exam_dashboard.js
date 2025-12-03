// =============================================================
// EMIS EXAM DASHBOARD JS — Typewriter + Modal + UX Enhancements
// =============================================================

document.addEventListener("DOMContentLoaded", () => {

  // -----------------------------------------------------------
  // 1. TYPEWRITER BANNER
  // -----------------------------------------------------------
  const typeTarget = document.getElementById("typewriter");

  if (typeTarget) {
    const lines = [
      "Welcome to your EMIS Exam Portal",
      "Read instructions carefully before starting",
      "Your progress is auto-saved"
    ];

    let index = 0;
    let char = 0;

    function typeLine() {
      if (char < lines[index].length) {
        typeTarget.textContent += lines[index][char];
        char++;
        setTimeout(typeLine, 50);
      } else {
        setTimeout(() => {
          typeTarget.textContent = "";
          char = 0;
          index = (index + 1) % lines.length;
          typeLine();
        }, 1500);
      }
    }

    typeLine();
  }


  // -----------------------------------------------------------
  // 2. SUPPORT MODAL (existing system)
  // -----------------------------------------------------------
  const supportModal = document.getElementById("supportModal");
  const openSupport = document.getElementById("openSupport");
  const closeSupport = document.getElementById("closeSupport");
  const dismissSupport = document.getElementById("dismissSupport");

  function showSupport() {
    supportModal?.classList.remove("hidden");
  }

  function hideSupport() {
    supportModal?.classList.add("hidden");
  }

  openSupport?.addEventListener("click", showSupport);
  closeSupport?.addEventListener("click", hideSupport);
  dismissSupport?.addEventListener("click", hideSupport);


  // -----------------------------------------------------------
  // 3. ACTIVITY LIST AUTO-TIMESTAMP
  // -----------------------------------------------------------
  const actMetaEls = document.querySelectorAll(".act-meta");
  const now = new Date().toLocaleTimeString();

  actMetaEls.forEach(el => {
    if (el.textContent.includes("Just now")) return;
    el.textContent = now;
  });


  // -----------------------------------------------------------
  // 4. Status pill subtle animation
  // -----------------------------------------------------------
  const pill = document.querySelector(".status-pill");
  if (pill) {
    pill.style.transition = "transform 0.3s ease, opacity 0.3s ease";
    pill.style.transform = "scale(1.05)";
    pill.style.opacity = "0.9";

    setTimeout(() => {
      pill.style.transform = "scale(1)";
      pill.style.opacity = "1";
    }, 350);
  }


  // -----------------------------------------------------------
  // 5. EXAM START CONFIRMATION MODAL
  // -----------------------------------------------------------
  const openExamModal = document.getElementById("openExamModal");
  const examStartModal = document.getElementById("examStartModal");
  const closeExamModal = document.getElementById("closeExamModal");

  // Open modal
  openExamModal?.addEventListener("click", () => {
    examStartModal?.classList.remove("hidden");
  });

  // Close modal with X button
  closeExamModal?.addEventListener("click", () => {
    examStartModal?.classList.add("hidden");
  });

  // Close modal if clicking outside the modal box
  examStartModal?.addEventListener("click", (e) => {
    if (e.target === examStartModal) {
      examStartModal.classList.add("hidden");
    }
  });

});

