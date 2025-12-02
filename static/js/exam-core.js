// ======================================================
// exam-core.js — MERGED FINAL CBT ENGINE (2025 v11)
// - Pure CBT engine (no anti-cheat; handled by exam-realtime.js)
// - Restores clocks/hourglass/topbar
// - Modern subject title with question count
// - Timer warnings (20, 10, 5 mins) + blinking < 60s
// - No internal shuffling (shuffle.js handles that)
// ======================================================

console.log("[exam-core] MERGED CBT ENGINE LOADED");

// ------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------
window.examData            = null;
window.currentQuestionIndex = 0;
window.userAnswers         = {};
window.lockedQuestions     = new Set();
window.flaggedQuestions    = new Set();
window.examTimer           = null;
window.timeRemaining       = 0;
window.initialTimeAllowed  = 0;    // for warning thresholds
window.examStarted         = false;
window.examStartTime       = null;
window.__examFinished      = false;
window.__timeExpired       = false;
window.__reviewBlocked     = false;

const SS_KEY       = "emis_exam_progress";
const LS_RELOADS   = "emis_exam_reload_count";
const LS_EXAM_LOCK = "emis_exam_lock_active";

// Timer warning flags (20, 10, 5 mins)
let __warn20Shown = false;
let __warn10Shown = false;
let __warn5Shown  = false;

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------
function $(s, r = document) { return r.querySelector(s); }
function $$(s, r = document) { return [...r.querySelectorAll(s)]; }

function formatTime(sec){
  const safe = Math.max(0, sec | 0);
  const m = Math.floor(safe / 60).toString().padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Optional flash helper (uses #examFlash or #flashMessage if present)
function examFlash(message, type = "info") {
  const flashEl =
    document.getElementById("examFlashMessage") ||
    document.getElementById("examFlash") ||
    document.getElementById("flashMessage");

  if (flashEl) {
    flashEl.textContent = message;
    flashEl.classList.add("show");
    flashEl.dataset.type = type;
    setTimeout(() => {
      flashEl.classList.remove("show");
    }, 5000);
  } else {
    // Fallback to alert if no flash container exists
    alert(message);
  }
}

// For future use if needed
function getCorrectIndex(q){
  if (typeof q.correctIndex === "number") return q.correctIndex;
  if (q.correctOption){
    return q.correctOption.trim().toUpperCase().charCodeAt(0) - 65;
  }
  return -1;
}

// ------------------------------------------------------
// NORMALIZE SUBJECT NAME (ROBUST MAP)
// ------------------------------------------------------
function normalizeSubjectName(subject){
  subject = subject.toLowerCase().trim();
  const map = {
    "financial accounting": "accounts",
    "accounting":          "accounts",
    "english language":    "english",
    "english":             "english",
    "mathematics":         "mathematics",
    "maths":               "mathematics",
    "literature-in-english": "literature",
    "literature":          "literature",
    "chemistry":           "chemistry",
    "physics":             "physics",
    "economics":           "economics",
    "government":          "government",
    "technical drawing":   "technical",
    "computer studies":    "computer",
    "biology":             "biology"
  };
  return map[subject] || subject.replace(/\s+/g, "");
}

// ------------------------------------------------------
// RESOLVE JSON PATH (INCLUDES /static)
// ------------------------------------------------------
function resolveExamJSON(subject, classCategory){
  const subjectKey = normalizeSubjectName(subject); // english
  const cls       = classCategory.toUpperCase();   // SS1
  const clsLower  = classCategory.toLowerCase();   // ss1

  return `/static/subjects/subjects-json/${cls}/${subjectKey}_${clsLower}.json`;
}

// ------------------------------------------------------
// LOAD EXAM DATA (QUIET MODE FOR startExam)
// ------------------------------------------------------
window.loadExamData = async function(quiet = false){
  try{
    const subjectMeta = $('meta[name="exam-subject"]');
    const classMeta   = $('meta[name="student-class"]');

    if (!subjectMeta || !classMeta) {
      throw new Error("Missing subject/class metadata.");
    }

    const subject       = subjectMeta.content;
    const classCategory = classMeta.content;
    const jsonURL       = resolveExamJSON(subject, classCategory);

    console.log("📥 Loading Exam JSON:", jsonURL);

    const res = await fetch(jsonURL, { cache: "no-store" });
    if (!res.ok) throw new Error("Exam JSON not found");

    let rawData = await res.json();

    // Standardize questions
    rawData.questions = (rawData.questions || []).map((q, idx) => {
      let rawCorrect =
        q.correctOption ||
        q.correct_option ||
        q.answer ||
        null;

      let ci = -1;
      if (rawCorrect) {
        const letter = rawCorrect.toString().trim().toUpperCase(); // A/B/C/D
        ci = letter.charCodeAt(0) - 65; // A=0
      }

      return {
        id:        q.id ?? idx,
        question:  q.question,
        options:   q.options,
        correctIndex: ci
      };
    });

    // ❗ NO internal shuffling here — shuffle.js will handle if needed
    window.examData = rawData;

    // Timer setup
    window.timeRemaining      = (rawData.time_allowed_minutes || 60) * 60;
    window.initialTimeAllowed = window.timeRemaining;

    // Reset timer warnings
    __warn20Shown = __warn10Shown = __warn5Shown = false;

    // Timer display
    const td = $("#timerDisplay");
    if (td) td.textContent = formatTime(window.timeRemaining);

    // Subject title: SUBJECT — N QUESTIONS (modernized)
    const st = $("#examSubjectTitle");
    if (st) {
      const totalQ = window.examData.questions.length;
      st.innerHTML = `
        <span class="exam-subject-pill">${subject.toUpperCase()}</span>
        <span class="exam-question-count">• ${totalQ} QUESTION${totalQ === 1 ? "" : "S"}</span>
      `;
      st.classList.remove("hidden");
    }

    // Total questions
    const totalQEl = $("#totalQuestions");
    if (totalQEl) totalQEl.textContent = window.examData.questions.length;

    // Load first question + nav/progress
    loadQuestion(0);
    updateProgress();
    updateQuestionNavigation();

  } catch (err) {
    console.error("❌ loadExamData error:", err);
    if (!quiet) {
      alert("Unable to load exam. Check if the subject file exists for your class.");
    }
    throw err;
  }
};

// ------------------------------------------------------
// LOAD SINGLE QUESTION  (with .qa-slide + fade-in)
// ------------------------------------------------------
window.loadQuestion = function(i){
  if (!window.examData) return;
  if (i < 0 || i >= window.examData.questions.length) return;

  window.currentQuestionIndex = i;
  const q   = window.examData.questions[i];
  const qid = q.id ?? i;

  $("#currentQuestionNumber").textContent = i + 1;

  const prev   = window.userAnswers[qid]?.index;
  const locked = window.lockedQuestions.has(qid);

  const html = (q.options || []).map((opt, idx) => {
    const selected = prev === idx ? "selected" : "";
    const dis      = locked ? "disabled" : "";
    return `
      <button class="option-btn ${selected}" data-option-index="${idx}" ${dis}>
        <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
        ${opt}
      </button>
    `;
  }).join("");

  $("#questionContent").innerHTML = `
    <div class="qa-slide fade-in-up">
      <h3 class="text-xl font-medium mb-4">${q.question}</h3>
      <div class="space-y-3">
        ${html}
      </div>
    </div>
  `;

  $$(".option-btn").forEach(btn => {
    btn.onclick = () => selectOption(Number(btn.dataset.optionIndex));
  });

  updateNavigationButtons();
  updateQuestionNavigation();
};

// ------------------------------------------------------
// SELECT OPTION
// ------------------------------------------------------
window.selectOption = function(idx){
  const q   = window.examData.questions[window.currentQuestionIndex];
  const qid = q.id ?? window.currentQuestionIndex;

  if (window.lockedQuestions.has(qid)) return;

  const correct   = q.correctIndex;
  const isCorrect = (idx === correct);

  window.userAnswers[qid] = { index: idx, correct: isCorrect };
  window.lockedQuestions.add(qid);

  $$(".option-btn").forEach(btn => {
    btn.disabled = true;
    btn.classList.toggle(
      "selected",
      Number(btn.dataset.optionIndex) === idx
    );
  });

  updateProgress();
  updateQuestionNavigation();

  setTimeout(() => {
    if (window.currentQuestionIndex < window.examData.questions.length - 1) {
      nextQuestion();
    } else {
      // Last question → trigger submit via button
      const nextBtn = $("#nextBtn");
      if (nextBtn) nextBtn.click();
      else submitExam(false);
    }
  }, 650);
};

// ------------------------------------------------------
// NAVIGATION
// ------------------------------------------------------
window.previousQuestion = function(){
  if (window.currentQuestionIndex > 0) {
    loadQuestion(window.currentQuestionIndex - 1);
  }
};

window.nextQuestion = function(){
  if (window.currentQuestionIndex < window.examData.questions.length - 1) {
    loadQuestion(window.currentQuestionIndex + 1);
  } else {
    submitExam(false);
  }
};

// ------------------------------------------------------
// PROGRESS
// ------------------------------------------------------
window.updateProgress = function(){
  const total    = window.examData?.questions?.length || 0;
  const answered = Object.keys(window.userAnswers).length;
  const pct      = total ? (answered / total) * 100 : 0;

  const ansEl  = $("#answeredCount");
  const remEl  = $("#remainingCount");
  const barEl  = $("#progressBar");
  const textEl = $("#progressText");

  if (ansEl)  ansEl.textContent  = answered;
  if (remEl)  remEl.textContent  = total - answered;
  if (barEl)  barEl.style.width  = `${pct}%`;
  if (textEl) textEl.textContent = `${Math.round(pct)}% Complete`;
};

window.updateNavigationButtons = function(){
  const prev = $("#prevBtn");
  const next = $("#nextBtn");

  if (prev) {
    prev.disabled = (window.currentQuestionIndex === 0);
  }

  if (next) {
    const last = (window.currentQuestionIndex === window.examData.questions.length - 1);
    next.textContent = last ? "Submit" : "Next →";
  }
};

window.updateQuestionNavigation = function(){
  const grid = $("#questionGrid");
  if (!grid || !window.examData) return;

  let html = "";
  for (let i = 0; i < window.examData.questions.length; i++) {
    const q   = window.examData.questions[i];
    const qid = q.id ?? i;

    const active   = (i === window.currentQuestionIndex) ? "active"    : "";
    const answered = window.userAnswers[qid]            ? "answered"  : "";

    html += `
      <button class="question-nav-btn ${active} ${answered}" data-q-index="${i}">
        ${i + 1}
      </button>
    `;
  }

  grid.innerHTML = html;

  $$(".question-nav-btn", grid).forEach(btn => {
    btn.onclick = () => loadQuestion(Number(btn.dataset.qIndex));
  });
};

// ------------------------------------------------------
// TIMER — with warnings & blinking < 60s
// ------------------------------------------------------
window.startTimer = function(){
  if (window.examTimer) clearInterval(window.examTimer);

  const timerDisplay = $("#timerDisplay");
  const timerWrapper = $("#examTimer");

  window.examTimer = setInterval(() => {
    window.timeRemaining--;

    // clamp
    if (window.timeRemaining < 0) window.timeRemaining = 0;

    // Update display
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(window.timeRemaining);

      // Blinking when less than 60 seconds
      if (window.timeRemaining <= 60) {
        timerDisplay.classList.add("timer-critical"); // CSS should handle blink
      } else {
        timerDisplay.classList.remove("timer-critical");
      }
    }

    // Threshold warnings: 20, 10, 5 minutes left
    const t = window.timeRemaining;
    const init = window.initialTimeAllowed || t;

    if (!__warn20Shown && init >= 20 * 60 && t <= 20 * 60 && t > 19 * 60) {
      examFlash("⏰ You have 20 minutes left.", "warning");
      __warn20Shown = true;
    }
    if (!__warn10Shown && init >= 10 * 60 && t <= 10 * 60 && t > 9 * 60) {
      examFlash("⏰ You have 10 minutes left.", "warning");
      __warn10Shown = true;
    }
    if (!__warn5Shown && init >= 5 * 60 && t <= 5 * 60 && t > 4 * 60) {
      examFlash("⚠️ Only 5 minutes left. Review and submit!", "danger");
      __warn5Shown = true;
    }

    // Time up
    if (t <= 0) {
      clearInterval(window.examTimer);
      window.__timeExpired = true;
      submitExam(true);
    }
  }, 1000);
};

// ------------------------------------------------------
// START EXAM  — Stable layout + clocks/hourglass visible
// ------------------------------------------------------
window.startExam = async function(){
  if (window.examStarted) return;
  window.examStarted = true;

  try {
    // 1️⃣ Avoid layout jumps: mark body as exam-started early
    document.body.classList.add("exam-started");

    // 2️⃣ Hide instructions modal instantly
    const modal = $("#instructionsModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }

    // 3️⃣ Show main exam interface
    const iface = $("#examInterface");
    if (iface) iface.classList.remove("hidden");

    // 4️⃣ Load exam data (quiet mode to avoid double alerts)
    await loadExamData(true);

    // 5️⃣ Start timer
    window.examStartTime = Date.now();
    startTimer();

    // 6️⃣ Show timer + fullscreen + student info block
    const timerBlock = $("#examTimer");
    if (timerBlock) timerBlock.classList.remove("hidden");

    const fullscreenBtn = $("#fullscreenBtn");
    if (fullscreenBtn) fullscreenBtn.classList.remove("hidden");

    const studentBlock = $(".exam-topbar-student");
    if (studentBlock) studentBlock.classList.remove("hidden");

  } catch (err) {
    console.error("❌ startExam error:", err);
    alert("Unable to start exam. Contact admin.");
  }
};

// ------------------------------------------------------
// END EXAM
// ------------------------------------------------------
window.endExam = function(){
  if (!window.examData) return;

  const total    = window.examData.questions.length;
  const answered = Object.keys(window.userAnswers).length;

  const msgEl = $("#endExamMessage");
  if (msgEl) {
    msgEl.innerHTML = `
      You answered <b>${answered}</b> out of <b>${total}</b>.<br>
      Unanswered will be marked incorrect.<br><br>
      Are you sure you want to end?
    `;
  }

  const modal = $("#endExamModal");
  if (modal) modal.classList.remove("hidden");
};

window.closeEndExam = () => {
  const modal = $("#endExamModal");
  if (modal) modal.classList.add("hidden");
};

// ------------------------------------------------------
// SUBMIT EXAM  — Perfectly aligned with backend fields
// ------------------------------------------------------
window.submitExam = async function(timeUp = false) {
    if (window.__examFinished) return;
    window.__examFinished = true;

    if (window.examTimer) clearInterval(window.examTimer);

    const total = window.examData?.questions?.length || 0;
    let correct = 0;

    if (Array.isArray(window.examData?.questions)) {
        window.examData.questions.forEach((q, i) => {
            const qid = q.id ?? i;
            const ua = window.userAnswers[qid];
            if (ua && ua.index === q.correctIndex) correct++;
        });
    }

    const incorrect = total - correct;
    const answered  = Object.keys(window.userAnswers).length;
    const skipped   = total - answered;

    // -----------------------------
    // FINAL PAYLOAD (100% backend-aligned)
    // -----------------------------
    const payload = {
        subject: $('meta[name="exam-subject"]').content,

        score: total ? Math.round((correct / total) * 100) : 0,
        correct: correct,
        incorrect: incorrect,
        total: total,
        answered: answered,
        skipped: skipped,

        flagged: window.flaggedQuestions.size,
        tabSwitches: window.__TAB_STRIKES || 0,

        time_taken: window.examStartTime
            ? Math.round((Date.now() - window.examStartTime) / 1000)
            : 0,

        submitted_at: new Date().toISOString(),

        status: timeUp ? "timeout" : "completed"
    };

    try {
        await fetch("/submit_exam", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("submitExam error:", e);
    }

    location.replace("/result");
};


// ------------------------------------------------------
// DOM READY
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = $("#startExamBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      window.startExam();
    });
  }
});
