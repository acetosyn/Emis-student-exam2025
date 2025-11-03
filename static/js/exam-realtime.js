/* =========================================================================
   EMIS CBT — Module 3: exam_realtime.js
   Extends exam_core + exam_features with:
   1) Real-time submission push to backend (admin dashboard)
   2) Candidate info (username, subject, score) is sent
   3) Lockout: user cannot re-enter dashboard after finish
   4) Event listeners for admin realtime updates
   5) Utility: safe fetch + retry
   ------------------------------------------------------------------------- */

(function () {
  if (!window || typeof window !== "object") return;

  // 1. Safe POST helper with retry
  async function safePost(url, payload, retries = 2) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (err) {
      if (retries > 0) {
        return await safePost(url, payload, retries - 1);
      }
      console.error("Realtime push failed:", err);
    }
  }

  // 2. Submission handler hook
  document.addEventListener("exam:submitted", async (e) => {
    const detail = e.detail || {};
    const candidate = window.currentCandidate || {}; // expect populated at login/dashboard

    const payload = {
      username: candidate.username || "unknown",
      fullname: candidate.fullname || "unknown",
      subject: candidate.subject || "N/A",
      score: detail.scorePercent || 0,
      correct: detail.correct || 0,
      total: detail.total || 0,
      answered: detail.answered || 0,
      timeTaken: detail.timeTaken || 0,
      submittedAt: new Date().toISOString(),
    };

    console.log("Pushing exam result to backend:", payload);

    await safePost("/api/exam/submit", payload);

    // Lock user from retaking exam
    try {
      localStorage.setItem("examFinished", "true");
    } catch {}
    window.__examFinished = true;
  });

  // 3. Lockout check (prevents going back to dashboard)
  function enforceLockout() {
    try {
      const done = localStorage.getItem("examFinished") === "true";
      if (done) {
        if (!window.location.pathname.includes("/result")) {
          window.location.href = "/result";
        }
      }
    } catch {}
  }

  // Run check when page loads
  document.addEventListener("DOMContentLoaded", enforceLockout);

  // 4. Optional: live event for admin dashboard
  //    (Here we only dispatch — actual socket/live update to admin handled server-side)
  function notifyAdminLocal(payload) {
    document.dispatchEvent(new CustomEvent("admin:scoreUpdate", { detail: payload }));
  }

  // Hook into exam submitted again for admin local updates
  document.addEventListener("exam:submitted", (e) => {
    notifyAdminLocal(e.detail);
  });
})();
