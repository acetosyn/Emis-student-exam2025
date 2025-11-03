// ===== Result Page JS =====
document.addEventListener("DOMContentLoaded", () => {
  loadResultData();
});

function loadResultData() {
  const result = window.resultData || null; // injected via Jinja

  // Handle empty / no results
  if (!result || !result.score) {
    const card = document.querySelector(".result-card");
    if (card) {
      card.innerHTML = `
        <div class="text-center p-6">
          <p class="text-red-600 font-semibold">⚠️ No exam results found for this user.</p>
          <button onclick="endExam()" class="mt-4 btn-primary">End</button>
        </div>
      `;
    }
    return;
  }

  // Score & progress circle animation
  animateScore(result.score);

  // Fraction score (correct / total)
  setText("correctAnswers", result.correct ?? 0);
  setText("totalQuestions", result.total ?? 0);

  // PASS / FAIL label (for quick view only)
  const passFail = document.getElementById("passFail");
  if (passFail) {
    if ((result.correct ?? 0) >= 20) {
      passFail.textContent = "PASS ✅";
      passFail.style.color = "green";
    } else {
      passFail.textContent = "FAIL ❌";
      passFail.style.color = "red";
    }
  }

  // Other Stats
  setText("timeTaken", formatTime(result.time_taken ?? 0));
  setText("answeredQuestions", result.answered ?? 0);
  setText("skippedQuestions", (result.total ?? 0) - (result.answered ?? 0));
  setText("flaggedQuestions", result.flagged ?? 0);
  setText("tabSwitches", result.tabSwitches ?? 0);

  // Accuracy %
  const accuracy = (result.answered && result.answered > 0)
    ? Math.round((result.correct / result.answered) * 100)
    : 0;
  setText("accuracyRate", accuracy + "%");

  // Avg. time per question
  const avg = (result.answered && result.answered > 0)
    ? Math.round(result.time_taken / result.answered)
    : 0;
  setText("avgTimePerQuestion", avg + "s");

  // Completion date
  const completionDate = result.submitted_at
    ? new Date(result.submitted_at).toLocaleString()
    : "N/A";
  setText("completionDate", completionDate);

  // Header message (just neutral)
  const headerMsg = document.getElementById("resultHeaderMessage");
  if (headerMsg) {
    headerMsg.textContent = "📊 You have completed your exam. Review your performance below.";
  }

  // Performance feedback box (staff recruitment rules)
  showPerformance(result.correct ?? 0);

  // Confetti celebration for excellent scores
  if ((result.correct ?? 0) >= 31) createConfetti();
}

// ===== Goodbye Modal =====
function endExam() {
  const modal = document.getElementById("goodbyeModal");
  if (modal) modal.style.display = "flex";
}
function closeGoodbye() {
  const modal = document.getElementById("goodbyeModal");
  if (modal) modal.style.display = "none";
}

// ===== Circle Animation =====
function animateScore(score) {
  const circle = document.getElementById("progressCircle");
  const display = document.getElementById("scoreDisplay");
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  if (circle) {
    circle.style.strokeDashoffset = offset;
    if (score >= 80) circle.style.stroke = "#16a34a";   // green
    else if (score >= 70) circle.style.stroke = "#f59e0b"; // amber
    else circle.style.stroke = "#dc2626"; // red
  }

  if (display) animateCounter(display, score, "%");
}

function animateCounter(el, target, suffix = "") {
  if (!el) return;
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 50));
  const interval = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(interval);
    }
    el.textContent = current + suffix;
  }, 30);
}

// ===== Helpers =====
function formatTime(seconds) {
  const sec = Number(seconds) || 0;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ===== Performance Box (Staff Recruitment Rules) =====
function showPerformance(rawScore) {
  const box = document.getElementById("performanceMessage");
  if (!box) return;

  let msg = "", color = "";

  if (rawScore <= 19) {
    msg = "❌ You failed! Unfortunately, your score did not meet the minimum requirement for consideration. Thank you for your interest.";
    color = "background:#fee2e2;color:#991b1b";
  } else if (rawScore >= 20 && rawScore <= 25) {
    msg = "✅ You achieved the minimum requirement.\nYour result will be reviewed by the administration.";
    color = "background:#fef9c3;color:#92400e";
  } else if (rawScore >= 26 && rawScore <= 30) {
    msg = "✅ You successfully passed with a solid score.\nYour performance meets the requirement. Await communication from the administration on the next stage.";
    color = "background:#eff6ff;color:#1e3a8a";
  } else if (rawScore >= 31 && rawScore <= 40) {
    msg = "🌟 Excellent result!\nYour performance has placed you in the top tier. Await further instructions for the next stage of the recruitment process.";
    color = "background:#dcfce7;color:#166534";
  }

  box.setAttribute("style", color + ";padding:1rem;border-radius:12px;line-height:1.4;white-space:pre-line");
  box.textContent = msg;
}

// ===== Confetti Animation =====
function createConfetti() {
  const container = document.getElementById("confetti-container");
  if (!container) return;
  const colors = ["#38bdf8", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6"];
  for (let i = 0; i < 50; i++) {
    const conf = document.createElement("div");
    conf.style.position = "absolute";
    conf.style.width = "10px";
    conf.style.height = "10px";
    conf.style.background = colors[Math.floor(Math.random() * colors.length)];
    conf.style.left = Math.random() * 100 + "%";
    conf.style.top = "-10px";
    conf.style.borderRadius = "50%";
    conf.style.animation = `confetti-fall ${2 + Math.random() * 3}s linear forwards`;
    container.appendChild(conf);
    setTimeout(() => conf.remove(), 5000);
  }
}

// ===== Actions =====
function viewResult() {
  window.location.reload();
}



