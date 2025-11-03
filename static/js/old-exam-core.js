// ======================================
// exam-core.js (Locked-Down Exam Engine)
// ======================================

console.log("[exam-core] 🚧 hardened build loaded");

// --------------------
// Global state
// --------------------
window.examData = null;
window.currentQuestionIndex = 0;
window.userAnswers = {};              // { [qid]: { index, correct } }
window.lockedQuestions = new Set();   // qids that cannot be re-answered
window.flaggedQuestions = new Set();
window.examTimer = null;
window.timeRemaining = 0;
window.examStarted = false;
window.examStartTime = null;
window.__examFinished = false;        // true when submitted/disqualified
window.__timeExpired = false;         // true once timer hits 0 (UI locks)
window.__reviewBlocked = false;       // blocks review/retake when time expires

// persistence keys
const SS_KEY       = "emis_exam_progress";
const LS_RELOADS   = "emis_exam_reload_count";
const LS_EXAM_LOCK = "emis_exam_lock_active"; // prevent retake/back-entry

// quick selectors
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function safeJSONParse(str, fb=null){ try{return JSON.parse(str);}catch{ return fb; } }

// resolve correctness (index or text)
function getCorrectIndex(q){
  if (typeof q.correctAnswer === "number") return q.correctAnswer;
  if (typeof q.answer === "string" && Array.isArray(q.options)){
    const ans = q.answer.trim().toLowerCase();
    return q.options.findIndex(o => String(o).trim().toLowerCase() === ans);
  }
  return -1;
}

// lightweight shuffle (Fisher–Yates)
function shuffleQuestions(data){
  try {
    if (!data || !Array.isArray(data.questions)) return data;
    const arr = [...data.questions];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return {...data, questions: arr};
  } catch {
    return data;
  }
}

// --------------------
// Anti-cheat & hardening
// --------------------
function setupAntiCheat(){
  // Context menu off during exam
  document.addEventListener("contextmenu", e => { if (window.examStarted && !window.__examFinished) e.preventDefault(); });

  // Block common shortcuts
  document.addEventListener("keydown", e => {
    if (!window.examStarted || window.__examFinished) return;

    // DevTools & view-source & select/copy/paste
    const k = e.key.toLowerCase();
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["i","j","c"].includes(k)) || (e.ctrlKey && ["u","s","p","a","c","v","x"].includes(k))) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block backspace navigating away when not focused inside input
    if (e.key === "Backspace" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) {
      e.preventDefault();
    }
  });

  // Visibility change (tab switch)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && window.examStarted && !window.__examFinished) {
      alert("⚠️ Leaving the exam tab is not allowed. This has been recorded.");
      window.tabSwitches = (window.tabSwitches || 0) + 1;
      saveProgress();
      if (window.tabSwitches >= 2) {
        submitExam(true); // disqualify on 2nd switch
      }
    }
  });

  // DevTools crude detection (window size heuristic)
  let devtoolsTrips = 0;
  setInterval(() => {
    const threshold = 160; // side dock width
    const suspicious = (window.outerWidth - window.innerWidth > threshold) || (window.outerHeight - window.innerHeight > threshold);
    if (suspicious && window.examStarted && !window.__examFinished) {
      devtoolsTrips++;
      if (devtoolsTrips === 1) {
        console.warn("[exam-core] DevTools suspected.");
        alert("⚠️ Developer tools are not allowed during the exam.");
      } else if (devtoolsTrips >= 2) {
        submitExam(true); // disqualify on repeated detection
      }
    }
  }, 1200);

  // Network strictness (grace 30s)
  let offlineAt = null;
  window.addEventListener("offline", () => {
    if (!window.examStarted || window.__examFinished) return;
    offlineAt = Date.now();
    alert("⚠️ You are offline. Reconnect within 30 seconds or the exam will auto-submit.");
  });
  window.addEventListener("online", () => { offlineAt = null; });
  setInterval(() => {
    if (offlineAt && Date.now() - offlineAt > 30000 && window.examStarted && !window.__examFinished) {
      submitExam(true); // disqualify if offline too long
    }
  }, 2500);
}
window.setupAntiCheat = setupAntiCheat;

// Warn on unload while exam is active (prevents accidental refresh/leave)
window.addEventListener("beforeunload", (e) => {
  if (window.examStarted && !window.__examFinished) {
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
});

// Detect hard reloads
function detectReload(){
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  return nav ? nav.type === "reload" : (performance.navigation && performance.navigation.type===1);
}

// Policy:
// - During exam (not finished): 1st reload => warning; 2nd => auto-submit (disqualify)
// - After time expiry (if UI is locked but submit not yet finished): treat any reload as above
function handleReloadPolicy(){
  if (!detectReload() || window.__examFinished) return;
  let count = Number(localStorage.getItem(LS_RELOADS)||"0")+1;
  localStorage.setItem(LS_RELOADS,String(count));
  if (count===1) {
    alert("⚠️ You cannot reload this page until you submit your exam. One more reload will auto-submit.");
  } else if (count>=2){
    console.warn("[exam-core] ❌ Second reload detected — auto-submitting.");
    submitExam(true); // disqualify
  }
}

// Hard lock overlay (used at timeout)
function lockUIForTimeout(){
  if (window.__timeExpired) return;
  window.__timeExpired = true;
  window.__reviewBlocked = true;

  // Disable all navigation & option buttons immediately
  $$(".option-btn").forEach(b => b.disabled = true);
  $("#prevBtn") && ( $("#prevBtn").disabled = true );
  $("#nextBtn") && ( $("#nextBtn").disabled = false, $("#nextBtn").textContent = "Submit" );
  $$("#questionGrid .question-nav-btn").forEach(b => { b.disabled = true; b.classList.add("disabled"); });

  // Add overlay
  const overlay = document.createElement("div");
  overlay.id = "exam-timeout-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(15,23,42,.7); color: #fff;
    display: flex; align-items: center; justify-content: center; z-index: 9999;
    font-size: 1rem; text-align: center; padding: 24px;
  `;
  overlay.innerHTML = `
    <div style="max-width:680px;">
      <h2 style="font-size:1.5rem;margin-bottom:.75rem;">⏰ Time is up</h2>
      <p>Your exam time has elapsed. Review is disabled. Click <b>Submit</b> to finalize.</p>
      <p style="opacity:.8;margin-top:.5rem;">Note: Reloading now will auto-submit after one warning.</p>
      <div style="margin-top:1rem;">
        <button id="forceSubmitBtn" style="padding:.6rem 1rem;border-radius:.6rem;">
          Submit Now
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  $("#forceSubmitBtn")?.addEventListener("click", () => submitExam(true)); // submit with timeout status
}

// Block retake/back-entry if exam was submitted
function enforceExamLockOnLoad(){
  const locked = localStorage.getItem(LS_EXAM_LOCK) === "1";
  if (locked && location.pathname.toLowerCase().includes("/exam")) {
    // Don’t allow re-entry into exam once submitted; bounce to result.
    location.replace("/result");
  }
}

// --------------------
// Load exam data (preview before start)
// --------------------
window.loadExamData = async function(subject){
  try {
    const res = await fetch(`/static/data/${subject}.json`,{cache:"no-store"});
    if (!res.ok) throw new Error(`Failed ${res.status}`);

    window.examData = shuffleQuestions(await res.json());

    window.timeRemaining = (Number(window.examData.time_allowed_minutes)||20)*60;
    $("#timerDisplay") && ($("#timerDisplay").textContent = formatTime(window.timeRemaining));
    $("#totalQuestions") && ($("#totalQuestions").textContent = window.examData.questions.length);

    updateQuestionNavigation();
    loadQuestion(0);
    updateProgress();
  }catch(err){
    console.error("[exam-core] loadExamData error:",err);
    alert("Unable to load exam data. Contact admin.");
  }
};

// --------------------
// Timer
// --------------------
window.startTimer = function(){
  if (window.examTimer) clearInterval(window.examTimer);
  window.examTimer = setInterval(()=>{
    window.timeRemaining--;
    $("#timerDisplay") && ($("#timerDisplay").textContent = formatTime(Math.max(0, window.timeRemaining)));
    if (window.timeRemaining<=0){
      clearInterval(window.examTimer);
      lockUIForTimeout();  // ✅ UI freezes; only submit allowed
      // Small guard in case network lag or UI race: submit shortly after
      setTimeout(() => { if (!window.__examFinished) submitExam(true); }, 2000);
    }
    saveProgress();
  },1000);
};

// --------------------
// Persistence
// --------------------
function saveProgress(){
  try{
    const payload = {
      currentQuestionIndex: window.currentQuestionIndex,
      userAnswers: window.userAnswers,
      locked: Array.from(window.lockedQuestions),
      timeRemaining: window.timeRemaining,
      examStarted: window.examStarted,
      examStartTime: window.examStartTime
    };
    sessionStorage.setItem(SS_KEY,JSON.stringify(payload));
  }catch{}
}
function loadProgress(){
  const saved = safeJSONParse(sessionStorage.getItem(SS_KEY));
  if (!saved) return false;
  try{
    window.currentQuestionIndex = saved.currentQuestionIndex||0;
    window.userAnswers = saved.userAnswers||{};
    window.lockedQuestions = new Set(saved.locked||[]);
    window.timeRemaining = saved.timeRemaining||window.timeRemaining;
    window.examStarted = !!saved.examStarted;
    window.examStartTime = saved.examStartTime||null;
    return true;
  }catch{ return false; }
}

// --------------------
// Question rendering
// --------------------
window.loadQuestion = function(index){
  if (!window.examData || window.__reviewBlocked) return;
  if (index<0 || index>=window.examData.questions.length) return;

  window.currentQuestionIndex = index;
  const q = window.examData.questions[index];
  const qid = q.id ?? index;
  $("#currentQuestionNumber") && ($("#currentQuestionNumber").textContent = index+1);

  const prevAns = window.userAnswers[qid]?.index;
  const locked = window.lockedQuestions.has(qid);

  const optionsHTML = (q.options||[]).map((opt,i)=>{
    const selected = prevAns===i ? "selected":""; const disabled = locked ? "disabled":"";
    return `<button class="option-btn ${selected}" data-option-index="${i}" ${disabled}>
      <span class="option-letter">${String.fromCharCode(65+i)}</span>${opt}
    </button>`;
  }).join("");

  $("#questionContent").innerHTML = `
    <div class="fade-in-up">
      <h3 class="text-xl font-medium mb-4">${q.question}</h3>
      <div class="space-y-3">${optionsHTML}</div>
    </div>`;

  $$(".option-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{ selectOption(Number(btn.dataset.optionIndex)); });
  });

  updateNavigationButtons();
  updateQuestionNavigation();
};

// --------------------
// Selection
// --------------------
window.selectOption = function(optionIndex){
  if (!window.examData || window.__reviewBlocked) return;
  const q = window.examData.questions[window.currentQuestionIndex];
  const qid = q.id ?? window.currentQuestionIndex;
  if (window.lockedQuestions.has(qid)) return;

  const correctIdx = getCorrectIndex(q);
  const isCorrect = (optionIndex===correctIdx);

  window.userAnswers[qid] = { index: optionIndex, correct: isCorrect };
  window.lockedQuestions.add(qid);

  $$(".option-btn").forEach(btn=>{
    btn.disabled=true;
    btn.classList.toggle("selected", Number(btn.dataset.optionIndex)===optionIndex);
  });

  if (typeof window.showAnswerFlash==="function"){
    window.showAnswerFlash(isCorrect);
  }

  updateProgress();
  updateQuestionNavigation();
  saveProgress();

  setTimeout(()=>{
    if (window.currentQuestionIndex < window.examData.questions.length-1){
      nextQuestion();
    } else {
      $("#nextBtn")?.click();
    }
  },700);
};

// --------------------
// Prev/Next
// --------------------
window.previousQuestion = function(){
  if (window.__reviewBlocked) return;
  if (window.currentQuestionIndex>0) loadQuestion(window.currentQuestionIndex-1);
};
window.nextQuestion = function(){
  if (window.__reviewBlocked) {
    // When time is up, "Next" acts as submit
    submitExam(true);
    return;
  }
  if (window.currentQuestionIndex<window.examData.questions.length-1){
    loadQuestion(window.currentQuestionIndex+1);
  } else {
    submitExam(false);
  }
};

// --------------------
// Progress
// --------------------
window.updateProgress = function(){
  if (!window.examData) return;
  const total = window.examData.questions.length;
  const answered = Object.keys(window.userAnswers).length;
  const remaining = total-answered;
  const pct = total? (answered/total)*100 : 0;
  $("#answeredCount") && ($("#answeredCount").textContent = answered);
  $("#remainingCount") && ($("#remainingCount").textContent = remaining);
  $("#progressBar") && ($("#progressBar").style.width=`${pct}%`);
  $("#progressText") && ($("#progressText").textContent = `${Math.round(pct)}% Complete`);
};

// --------------------
// Navigation UI
// --------------------
window.updateNavigationButtons = function(){
  const prev=$("#prevBtn"), next=$("#nextBtn");
  if (prev) prev.disabled = window.__reviewBlocked || window.currentQuestionIndex===0;
  if (next){
    const last = window.currentQuestionIndex===window.examData.questions.length-1;
    if (window.__reviewBlocked) {
      next.textContent = "Submit";
      next.disabled = false;
    } else {
      next.textContent = last? "Submit":"Next →";
      next.disabled=false;
    }
  }
};
window.updateQuestionNavigation = function(){
  const grid=$("#questionGrid");
  if (!grid||!window.examData) return;
  let html="";
  for (let i=0;i<window.examData.questions.length;i++){
    const q=window.examData.questions[i];
    const qid=q?.id??i;
    const active=i===window.currentQuestionIndex?"active":"";
    const answered=window.userAnswers[qid]?"answered":"";
    const disabled = window.__reviewBlocked ? "disabled" : "";
    html+=`<button class="question-nav-btn ${active} ${answered}" data-q-index="${i}" ${disabled}>${i+1}</button>`;
  }
  grid.innerHTML=html;
  if (!window.__reviewBlocked) {
    $$(".question-nav-btn",grid).forEach(btn=>{
      btn.onclick=()=>loadQuestion(Number(btn.dataset.qIndex||btn.dataset["q-index"]||btn.getAttribute("data-q-index")));
    });
  }
};

// --------------------
// Fullscreen
// --------------------
window.toggleFullscreen=function(){
  if (!document.fullscreenElement){
    (document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen||document.documentElement.msRequestFullscreen)?.call(document.documentElement);
  } else {
    (document.exitFullscreen||document.webkitExitFullscreen||document.msExitFullscreen)?.call(document);
  }
};

// --------------------
// Results & Submit
// --------------------
function calculateResults(){
  if (!window.examData || !Array.isArray(window.examData.questions)) {
    return { totalQuestions: 0, answeredQuestions: 0, correctAnswers: 0, score: 0, timeTaken: 0 };
  }
  const total = window.examData.questions.length;
  let correct = 0;
  window.examData.questions.forEach((q,i)=>{
    const qid = q.id ?? i;
    const ua = window.userAnswers[qid];
    if (!ua) return;
    const right = getCorrectIndex(q);
    if (ua.index === right) correct++;
  });
  return {
    totalQuestions: total,
    answeredQuestions: Object.keys(window.userAnswers).length,
    correctAnswers: correct,
    score: total ? Math.round((correct/total) * 100) : 0,
    timeTaken: Math.round((Date.now() - (window.examStartTime || Date.now()))/1000)
  };
}

window.submitExam = async function(timeUp=false){
  if (window.__examFinished) return;
  window.__examFinished=true;

  // prevent further reload warnings and nav
  try { localStorage.setItem(LS_EXAM_LOCK, "1"); } catch {}
  try { sessionStorage.removeItem(SS_KEY);} catch {}

  if (window.examTimer) clearInterval(window.examTimer);

  const res=calculateResults();
  try{
    await fetch("/api/exam/submit",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        score: res.score,
        correct: res.correctAnswers,
        total: res.totalQuestions,
        answered: res.answeredQuestions,
        timeTaken: res.timeTaken,
        submittedAt: new Date().toISOString(),
        status: timeUp? "timeout":"completed"
      })
    });
  }catch(e){ console.error("[exam-core] submit error:", e); }
  finally{
    // go to result with replace() so back button can’t return to exam history entry
    location.replace("/result");
  }
};

// --------------------
// Start / End Exam
// --------------------
window.startExam = async function(){
  if (window.examStarted) return;
  window.examStarted = true;

  try {
    const subject = (document.querySelector('meta[name="exam-subject"]')?.content || "biology").toLowerCase();
    const res = await fetch(`/static/data/${subject}.json`, {cache:"no-store"});
    if (!res.ok) throw new Error(`Failed ${res.status}`);

    window.examData = shuffleQuestions(await res.json());

    // Restore if any
    if (loadProgress()) {
      // If saved state says time already up, hard lock immediately
      if (window.timeRemaining <= 0) {
        lockUIForTimeout();
      } else {
        startTimer();
      }
      loadQuestion(window.currentQuestionIndex);
    } else {
      // Fresh start
      window.examStartTime = Date.now();
      window.timeRemaining = (window.examData.time_allowed_minutes || 20) * 60;
      loadQuestion(0);
      startTimer();
    }

    $("#instructionsModal")?.classList.add("hidden");
    $("#examInterface")?.classList.remove("hidden");
    $("#examTimer")?.classList.remove("hidden");
    $("#fullscreenBtn")?.classList.remove("hidden");

  } catch (err) {
    console.error("[exam-core] startExam error:", err);
    alert("Unable to start exam. Contact admin.");
  }
};

window.endExam = function() {
  if (!window.examData) return;

  const total = window.examData.questions.length;
  const answered = Object.keys(window.userAnswers).length;
  const remaining = total - answered;

  const msg = `
    Are you sure you want to end this exam?<br><br>
    <ul style="margin-left:1.2em;list-style:disc;">
      <li>You have answered <b>${answered}</b> out of <b>${total}</b> questions.</li>
      <li><b>${remaining}</b> unanswered questions will be marked incorrect.</li>
      <li>You will not be able to retake this exam.</li>
    </ul>
  `;

  const modal = document.getElementById("endExamModal");
  const msgEl = document.getElementById("endExamMessage");
  if (msgEl) msgEl.innerHTML = msg;
  if (modal) modal.classList.remove("hidden");
};

window.closeEndExam = function() {
  document.getElementById("endExamModal")?.classList.add("hidden");
};

// --------------------
// Result-page hardening
// --------------------
function hardenResultPageIfApplicable(){
  if (!location.pathname.toLowerCase().includes("/result")) return;

  // Clear in-exam guards
  try { sessionStorage.removeItem(SS_KEY); } catch {}
  try { localStorage.setItem(LS_EXAM_LOCK, "1"); } catch {}
  try { localStorage.removeItem(LS_RELOADS); } catch {}

  // Kill history back to exam: push a new state and always bounce forward
  history.replaceState({r:1}, "", location.href);
  history.pushState({r:2}, "", location.href);
  window.addEventListener("popstate", () => {
    // Attempt to close; if blocked, just keep user on results (or exit site)
    try { window.close(); } catch {}
    setTimeout(() => location.replace("/result"), 0);
  });

  // Block refresh/leave prompts on result? No prompt; but prevent going back to exam cache
  // (Server should also set no-store; client-side we can try to purge)
  if ("caches" in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(()=>{});
  }
}

// --------------------
// DOM Ready
// --------------------
function setupKeyboardNav(){
  document.addEventListener("keydown",e=>{
    if (!window.examStarted||window.__examFinished) return;
    if (e.key==="ArrowRight"){ e.preventDefault(); nextQuestion(); }
    if (e.key==="ArrowLeft"){ e.preventDefault(); previousQuestion(); }
    if (e.key==="Enter"){ e.preventDefault(); $("#nextBtn")?.click(); }
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  enforceExamLockOnLoad();      // ⛔️ prevents coming back to /exam after submit
  hardenResultPageIfApplicable();

  $("#startExamBtn")?.addEventListener("click",e=>{ e.preventDefault(); startExam(); });
  $("#fullscreenBtn")?.addEventListener("click",e=>{ e.preventDefault(); toggleFullscreen(); });

  const subject=(document.querySelector('meta[name="exam-subject"]')?.content||"biology").toLowerCase();
  if (!location.pathname.toLowerCase().includes("/result")) {
    loadExamData(subject);
  }

  setupAntiCheat();
  setupKeyboardNav();
  handleReloadPolicy();
});

// ============== END ==================
