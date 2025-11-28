// ======================================
// exam-core.js — FINAL FULL BUILD (2025)
// ======================================

console.log("[exam-core] FINAL CLASS-BASED CBT ENGINE LOADED");

// ------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------
window.examData = null;
window.currentQuestionIndex = 0;
window.userAnswers = {};
window.lockedQuestions = new Set();
window.flaggedQuestions = new Set();
window.examTimer = null;
window.timeRemaining = 0;
window.examStarted = false;
window.examStartTime = null;
window.__examFinished = false;
window.__timeExpired = false;
window.__reviewBlocked = false;

const SS_KEY       = "emis_exam_progress";
const LS_RELOADS   = "emis_exam_reload_count";
const LS_EXAM_LOCK = "emis_exam_lock_active";

// helpers
function $(s,r=document){return r.querySelector(s);}
function $$(s,r=document){return [...r.querySelectorAll(s)];}
function formatTime(sec){ const m=Math.floor(sec/60).toString().padStart(2,"0"); const s=(sec%60).toString().padStart(2,"0"); return `${m}:${s}`;}
function safeJSONParse(s,f=null){try{return JSON.parse(s);}catch{return f;}}

// correct index resolver
function getCorrectIndex(q){
  if (typeof q.correctIndex === "number") return q.correctIndex;
  if (q.correctOption) {
    return q.correctOption.trim().toUpperCase().charCodeAt(0) - 65;
  }
  return -1;
}

// shuffle
function shuffleQuestions(data){
  try{
    if (!data || !Array.isArray(data.questions)) return data;
    const arr=[...data.questions];
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return {...data,questions:arr};
  }catch{
    return data;
  }
}

// ------------------------------------------------------
// NORMALIZE SUBJECT NAME
// ------------------------------------------------------
function normalizeSubjectName(subject){
  subject=subject.toLowerCase().trim();
  const map={
    "financial accounting":"accounts",
    "accounting":"accounts",
    "english language":"english",
    "english":"english",
    "mathematics":"mathematics",
    "maths":"mathematics",
    "literature-in-english":"literature",
    "literature":"literature",
    "chemistry":"chemistry",
    "physics":"physics",
    "economics":"economics",
    "government":"government",
    "technical drawing":"technical",
    "computer studies":"computer",
    "biology":"biology"
  };
  return map[subject] || subject.replace(/\s+/g,"");
}

// ------------------------------------------------------
// RESOLVE JSON PATH (FIXED: MUST INCLUDE /static)
// ------------------------------------------------------
function resolveExamJSON(subject, classCategory){
  const subjectKey = normalizeSubjectName(subject);     // english
  const cls = classCategory.toUpperCase();              // SS1
  const clsLower = classCategory.toLowerCase();         // ss1

  // 🔥 THIS IS THE CORRECT WORKING PATH
  return `/static/subjects/subjects-json/${cls}/${subjectKey}_${clsLower}.json`;
}

// ------------------------------------------------------
// LOAD EXAM DATA
// ------------------------------------------------------
window.loadExamData = async function(){
  try{
    const subjectMeta = $('meta[name="exam-subject"]');
    const classMeta   = $('meta[name="student-class"]');

    if (!subjectMeta || !classMeta){
      alert("Missing subject/class metadata.");
      return;
    }

    const subject = subjectMeta.content;
    const classCategory = classMeta.content;

    const jsonURL = resolveExamJSON(subject, classCategory);
    console.log("📥 Loading Exam JSON:", jsonURL);

    const res = await fetch(jsonURL, {cache:"no-store"});
    if (!res.ok) throw new Error("File not found");

    let rawData = await res.json();

    // standardize data
    rawData.questions = rawData.questions.map(q=>{
      let idx=-1;
      if(q.correctOption){
        idx=q.correctOption.trim().toUpperCase().charCodeAt(0)-65;
      }
      return {
        id:q.id,
        question:q.question,
        options:q.options,
        correctIndex:idx
      };
    });

    window.examData = shuffleQuestions(rawData);
    window.timeRemaining = (rawData.time_allowed_minutes || 60) * 60;

    $("#timerDisplay").textContent = formatTime(window.timeRemaining);
    $("#totalQuestions").textContent = window.examData.questions.length;

    loadQuestion(0);
    updateProgress();
    updateQuestionNavigation();

  }catch(err){
    console.error("❌ loadExamData error:", err);
    alert("Unable to load exam. Check if JSON exists in your class folder.");
  }
};
// ------------------------------------------------------
// LOAD SINGLE QUESTION  (UPDATED WITH .qa-slide FIX)
// ------------------------------------------------------
window.loadQuestion = function(i){
  if (!window.examData) return;
  if (i < 0 || i >= window.examData.questions.length) return;

  window.currentQuestionIndex = i;
  const q = window.examData.questions[i];
  const qid = q.id ?? i;

  $("#currentQuestionNumber").textContent = i + 1;

  const prev = window.userAnswers[qid]?.index;
  const locked = window.lockedQuestions.has(qid);

  const html = q.options.map((opt, idx) => {
    const selected = prev === idx ? "selected" : "";
    const dis = locked ? "disabled" : "";
    return `
      <button class="option-btn ${selected}" data-option-index="${idx}" ${dis}>
        <span class="option-letter">${String.fromCharCode(65 + idx)}</span>${opt}
      </button>`;
  }).join("");

  // ✔ FIX: Add .qa-slide wrapper so exam-features.js works correctly
  $("#questionContent").innerHTML = `
    <div class="qa-slide fade-in-up">
      <h3 class="text-xl font-medium mb-4">${q.question}</h3>
      <div class="space-y-3">
        ${html}
      </div>
    </div>
  `;

  // Attach click handlers
  $$(".option-btn").forEach(btn => {
    btn.onclick = () => selectOption(Number(btn.dataset.optionIndex));
  });

  updateNavigationButtons();
  updateQuestionNavigation();
};



// ------------------------------------------------------
// SELECT OPTION (UNCHANGED — COMPATIBLE WITH FEATURES)
// ------------------------------------------------------
window.selectOption = function(idx){
  const q = window.examData.questions[window.currentQuestionIndex];
  const qid = q.id ?? window.currentQuestionIndex;

  if (window.lockedQuestions.has(qid)) return;

  const correct = q.correctIndex;
  const isCorrect = (idx === correct);

  window.userAnswers[qid] = { index: idx, correct: isCorrect };
  window.lockedQuestions.add(qid);

  $$(".option-btn").forEach(btn => {
    btn.disabled = true;
    btn.classList.toggle("selected", Number(btn.dataset.optionIndex) === idx);
  });

  updateProgress();
  updateQuestionNavigation();

  setTimeout(() => {
    if (window.currentQuestionIndex < window.examData.questions.length - 1) {
      nextQuestion();
    } else {
      $("#nextBtn").click();
    }
  }, 650);
};


// ------------------------------------------------------
// NAVIGATION
// ------------------------------------------------------
window.previousQuestion = function(){
  if (window.currentQuestionIndex>0) loadQuestion(window.currentQuestionIndex-1);
};
window.nextQuestion = function(){
  if (window.currentQuestionIndex < window.examData.questions.length-1){
    loadQuestion(window.currentQuestionIndex+1);
  } else {
    submitExam(false);
  }
};

// ------------------------------------------------------
// PROGRESS
// ------------------------------------------------------
window.updateProgress = function(){
  const total = window.examData.questions.length;
  const answered = Object.keys(window.userAnswers).length;
  const pct = total ? (answered/total)*100 : 0;

  $("#answeredCount").textContent = answered;
  $("#remainingCount").textContent = total-answered;
  $("#progressBar").style.width = `${pct}%`;
  $("#progressText").textContent = `${Math.round(pct)}% Complete`;
};

window.updateNavigationButtons = function(){
  const prev=$("#prevBtn"), next=$("#nextBtn");
  if(prev) prev.disabled = window.currentQuestionIndex===0;
  if(next){
    const last = window.currentQuestionIndex===window.examData.questions.length-1;
    next.textContent = last ? "Submit" : "Next →";
  }
};

window.updateQuestionNavigation = function(){
  const grid = $("#questionGrid");
  if (!grid) return;

  let html="";
  for(let i=0;i<window.examData.questions.length;i++){
    const q = window.examData.questions[i];
    const qid = q.id ?? i;
    const active = i===window.currentQuestionIndex ? "active":"";
    const answered = window.userAnswers[qid] ? "answered":"";
    html += `<button class="question-nav-btn ${active} ${answered}" data-q-index="${i}">${i+1}</button>`;
  }
  grid.innerHTML = html;

  $$(".question-nav-btn",grid).forEach(btn=>{
    btn.onclick=()=>loadQuestion(Number(btn.dataset.qIndex));
  });
};

// ------------------------------------------------------
// TIMER
// ------------------------------------------------------
window.startTimer = function(){
  if(window.examTimer) clearInterval(window.examTimer);

  window.examTimer=setInterval(()=>{
    window.timeRemaining--;
    $("#timerDisplay").textContent = formatTime(Math.max(0,window.timeRemaining));
    if(window.timeRemaining<=0){
      clearInterval(window.examTimer);
      lockUIForTimeout();
      setTimeout(()=>submitExam(true),1500);
    }
  },1000);
};

// ------------------------------------------------------
// FULLSCREEN
// ------------------------------------------------------
window.toggleFullscreen = function(){
  if(!document.fullscreenElement){
    document.documentElement.requestFullscreen?.();
  }else{
    document.exitFullscreen?.();
  }
};

// ------------------------------------------------------
// START EXAM  (NO JUMP VERSION - STABLE LAYOUT)
// ------------------------------------------------------
window.startExam = async function () {
  if (window.examStarted) return;
  window.examStarted = true;

  try {
    // 1️⃣ Mark body as "exam-started" so topbar layout is stable from the start
    document.body.classList.add("exam-started");

    // 2️⃣ Instantly hide instructions modal (no visual jump)
    const modal = $("#instructionsModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }

    // 3️⃣ Show the main exam interface immediately
    $("#examInterface").classList.remove("hidden");

    // 4️⃣ Resolve subject + class and JSON URL
    const subjectMeta = $('meta[name="exam-subject"]');
    const classMeta   = $('meta[name="student-class"]');
    const subject     = subjectMeta.content;
    const classCategory = classMeta.content;

    const jsonURL = resolveExamJSON(subject, classCategory);
    console.log("🚀 startExam → JSON:", jsonURL);

    const res = await fetch(jsonURL, { cache: "no-store" });
    if (!res.ok) throw new Error("JSON missing");

    let rawData = await res.json();

    // 5️⃣ Normalise / detect correct answer letter
    rawData.questions = rawData.questions.map(q => {
      let rawCorrect = q.correctOption || q.correct_option || q.answer || null;
      let idx = -1;

      if (rawCorrect) {
        const letter = rawCorrect.toString().trim().toUpperCase(); // A/B/C/D
        idx = letter.charCodeAt(0) - 65; // A=0
      }

      return {
        id: q.id,
        question: q.question,
        options: q.options,
        correctIndex: idx
      };
    });

    // 6️⃣ Shuffle questions
    window.examData = shuffleQuestions(rawData);

    // 7️⃣ Timer setup
    window.examStartTime = Date.now();
    window.timeRemaining = (rawData.time_allowed_minutes || 60) * 60;

    // 8️⃣ Update "Question 1 / N"
    $("#totalQuestions").textContent = window.examData.questions.length;

    // 9️⃣ Load first question + start countdown
    loadQuestion(0);
    startTimer();

    // 🔟 Show top-right controls
    $("#examTimer").classList.remove("hidden");
    $("#fullscreenBtn").classList.remove("hidden");
    const studentBlock = $(".exam-topbar-student");
    if (studentBlock) studentBlock.classList.remove("hidden");

    // 1️⃣1️⃣ Show subject title + question count
    const st = $("#examSubjectTitle");
    if (st) {
      st.innerHTML = `
        <span style="color:#E30613">${subject.toUpperCase()}</span>
        — ${window.examData.questions.length} QUESTIONS
      `;
      st.classList.remove("hidden");
    }

  } catch (err) {
    console.error("❌ startExam:", err);
    alert("Unable to start exam. Contact admin.");
  }
};


// ------------------------------------------------------
// END EXAM
// ------------------------------------------------------
window.endExam = function(){
  const total = window.examData.questions.length;
  const answered = Object.keys(window.userAnswers).length;

  $("#endExamMessage").innerHTML = `
    You answered <b>${answered}</b> out of <b>${total}</b>.<br>
    Unanswered will be marked incorrect.<br><br>
    Are you sure you want to end?
  `;
  $("#endExamModal").classList.remove("hidden");
};
window.closeEndExam = ()=>$("#endExamModal").classList.add("hidden");

// ------------------------------------------------------
// SUBMIT EXAM
// ------------------------------------------------------
window.submitExam = async function(timeUp=false){
  if(window.__examFinished) return;
  window.__examFinished=true;

  if(window.examTimer) clearInterval(window.examTimer);

  const total=window.examData.questions.length;
  let correct=0;
  window.examData.questions.forEach((q,i)=>{
    const qid=q.id??i;
    const ua=window.userAnswers[qid];
    if(ua && ua.index===q.correctIndex) correct++;
  });

  const payload={
    score: Math.round((correct/total)*100),
    correct,
    total,
    answered:Object.keys(window.userAnswers).length,
    timeTaken:Math.round((Date.now()-window.examStartTime)/1000),
    submittedAt:new Date().toISOString(),
    status:timeUp?"timeout":"completed"
  };

  try{
    await fetch("/api/exam/submit",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
  }catch(e){ console.error(e); }

  location.replace("/result");
};


// ------------------------------------------------------
// DOM READY
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {

  // attach startExam button
  const startBtn = document.getElementById("startExamBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      window.startExam();
    });
  }

});
// ======================================