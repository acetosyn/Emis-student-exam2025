/* =====================================================================
   exam-features.js (2025 — FIXED VERSION)
   Visual feedback ✔/✖, submit modal, CTA sync, answered dot, unload guard
   Fully Compatible with new exam-core.js (correctIndex-based marking)
   ===================================================================== */

(function(){
  if (!window || typeof window !== "object") return;

  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  // ----------------------------
  // Tiny toast
  // ----------------------------
  function toast(msg, type="info", ms=2400){
    const wrap=document.createElement("div");
    const colors={
      success:"#16a34a", error:"#dc2626",
      warning:"#f59e0b", info:"#2563eb"
    };
    wrap.textContent=msg;
    wrap.style.cssText=`position:fixed;top:18px;right:18px;z-index:9999;
      padding:10px 14px;border-radius:10px;font-weight:700;color:#fff;
      background:${colors[type]||colors.info};
      box-shadow:0 10px 30px rgba(0,0,0,.25);
      opacity:0;transform:translateY(-8px);
      transition:all .25s ease`;
    document.body.appendChild(wrap);
    requestAnimationFrame(()=>{
      wrap.style.opacity="1";
      wrap.style.transform="translateY(0)";
    });
    setTimeout(()=>{
      wrap.style.opacity="0";
      wrap.style.transform="translateY(-8px)";
      setTimeout(()=>wrap.remove(),250);
    },ms);
  }

  // ----------------------------
  // Inject Styles
  // ----------------------------
  const style=document.createElement("style");
  style.textContent=`
    .eflash{
      position:absolute;top:-10px;right:-10px;
      padding:8px 10px;border-radius:50%;
      font-weight:800;color:#fff;
      box-shadow:0 8px 22px rgba(0,0,0,.25);
      opacity:0;scale:.9;transition:all .25s ease;
      z-index:30
    }
    .eflash.show{opacity:1;scale:1}
    .eflash.ok{background:#16a34a}
    .eflash.bad{background:#dc2626}

    .question-nav-btn .dot{
      position:absolute;top:6px;right:6px;
      width:8px;height:8px;border-radius:50%;
      background:#16a34a;box-shadow:0 0 0 2px #fff
    }

    #nextBtn.pulse{animation:pulseBtn 1s ease-in-out 2}

    @keyframes pulseBtn{
      0%{transform:scale(1)}
      50%{transform:scale(1.05)}
      100%{transform:scale(1)}
    }
  `;
  document.head.appendChild(style);

  // -------------------------------------------------------
  // FIXED: Flash ✔ / ✖ (Uses q.correctIndex ONLY)
  // -------------------------------------------------------
  const hookFlash = () => {
    const orig = window.selectOption;

    window.selectOption = function(optionIndex) {
      const q = window.examData?.questions?.[window.currentQuestionIndex];
      const host = $("#questionContent");

      if (q && host) {
        const rightIdx = q.correctIndex;  // ✔ Correct logic

        const ok = (optionIndex === rightIdx);

        let pill = host.querySelector(".eflash");
        if (!pill) {
          pill = document.createElement("div");
          pill.className = "eflash";
          host.style.position = "relative";
          host.appendChild(pill);
        }

        pill.className = "eflash " + (ok ? "ok" : "bad");
        pill.textContent = ok ? "✔" : "✖";

        requestAnimationFrame(() => pill.classList.add("show"));
        setTimeout(() => pill.classList.remove("show"), 650);
      }

      return orig.apply(this, arguments);
    };
  };

  // ----------------------------
  // Sync CTA (Next / Submit)
  // ----------------------------
  function syncCTA(){
    const nextBtn=$("#nextBtn");
    if(!nextBtn || !window.examData) return;

    const last = (window.currentQuestionIndex === window.examData.questions.length - 1);

    nextBtn.textContent = last ? "Submit" : "Next →";
    nextBtn.onclick = last ? openSubmitConfirm : window.nextQuestion;

    if(last) nextBtn.classList.add("pulse");
    else nextBtn.classList.remove("pulse");
  }

  // ----------------------------
  // Answered dots in grid
  // ----------------------------
  function decorateAnsweredDots(){
    $$(".question-nav-btn").forEach((btn,idx)=>{
      const qid = window.examData?.questions?.[idx]?.id ?? idx;
      if(window.userAnswers && window.userAnswers[qid]){
        btn.style.position="relative";
        if(!btn.querySelector(".dot")){
          const dot=document.createElement("span");
          dot.className="dot"; btn.appendChild(dot);
        }
      }else{
        const dot=btn.querySelector(".dot");
        if(dot) dot.remove();
      }
    });
  }

  // ----------------------------
  // Submit Modal
  // ----------------------------
  function openSubmitConfirm(){
    const total=window.examData?.questions?.length||0;
    const answered=Object.keys(window.userAnswers||{}).length;
    const unanswered=total-answered;

    const wrap=document.createElement("div");
    wrap.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;z-index:9999";

    wrap.innerHTML=`
      <div style="background:#fff;border-radius:16px;max-width:560px;width:94%;
                  padding:20px;box-shadow:0 14px 36px rgba(30,58,138,.35)">
        <h3 style="margin:0 0 12px;font-size:1.25rem;font-weight:800;color:#1e3a8a">
          Submit Exam?
        </h3>

        <p>You answered <b>${answered}</b> of <b>${total}</b> questions.</p>

        ${
          unanswered>0
          ? `<p style="color:#b45309;background:#fef3c7;border:1px solid #fde68a;
                      padding:10px;border-radius:10px">
                ${unanswered} unanswered will be marked incorrect.
             </p>`
          : `<p style="color:#166534;background:#dcfce7;border:1px solid #bbf7d0;
                        padding:10px;border-radius:10px">
                All questions answered ✔
             </p>`
        }

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button id="cxl" style="padding:10px 16px;border-radius:10px;
                 background:#f1f5f9;border:1px solid #cbd5e1">Review</button>

          <button id="ok" style="padding:10px 16px;border-radius:10px;
                 background:#dc2626;color:#fff">Submit</button>
        </div>
      </div>`;

    document.body.appendChild(wrap);

    $("#cxl",wrap).onclick = () => wrap.remove();
    $("#ok",wrap).onclick = () => { wrap.remove(); window.submitExam(false); };
  }

  // ----------------------------
  // Before unload guard
  // ----------------------------
  function setupUnloadGuard(){
    window.addEventListener("beforeunload",e=>{
      if(window.examStarted && !window.__examFinished){
        e.preventDefault();
        e.returnValue="";
        return "";
      }
    });
  }

  // ----------------------------
  // Patch hooks
  // ----------------------------
  function patchCoreHooks(){
    const origLoad = window.loadQuestion;
    window.loadQuestion = function(){
      const r = origLoad.apply(this,arguments);
      syncCTA();
      decorateAnsweredDots();
      return r;
    };

    const origUpd = window.updateNavigationButtons;
    window.updateNavigationButtons = function(){
      const r = origUpd.apply(this,arguments);
      syncCTA();
      return r;
    };
  }

  function patchStartExam(){
    const orig = window.startExam;
    window.startExam = async function(){
      const r = await orig.apply(this,arguments);
      setupUnloadGuard();
      toast("Tip: Use ← → or Enter to navigate", "info", 2600);
      return r;
    };
  }

  // ----------------------------
  // Boot
  // ----------------------------
  document.addEventListener("DOMContentLoaded",()=>{
    hookFlash();
    patchCoreHooks();
    patchStartExam();

    const boot=()=>{
      if(window.examData){ syncCTA(); decorateAnsweredDots(); }
      else setTimeout(boot,200);
    };
    boot();
  });

})();

/* =====================================================
   transition.js (slide transitions)
   ===================================================== */
(function(){
  const style=document.createElement("style");
  style.textContent=`
    .qa-slide{will-change:transform,opacity}
    .slide-enter{opacity:0;transform:translateX(24px)}
    .slide-enter-active{transition:all .28s ease;opacity:1;transform:translateX(0)}
    .slide-exit{opacity:1;transform:translateX(0)}
    .slide-exit-active{transition:all .28s ease;opacity:0;transform:translateX(-24px)}
  `;
  document.head.appendChild(style);

  let lastNode=null;

  document.addEventListener("question:willChange",()=>{
    const host=document.querySelector("#questionContent .qa-slide");
    if(host){
      lastNode=host.cloneNode(true);
      host.parentElement.insertBefore(lastNode,host);
    }
  });

  document.addEventListener("question:didChange",()=>{
    const host=document.querySelector("#questionContent .qa-slide");
    if(host){
      host.classList.add("slide-enter");
      requestAnimationFrame(()=>host.classList.add("slide-enter-active"));
      setTimeout(()=>host.classList.remove("slide-enter","slide-enter-active"),300);
    }

    if(lastNode){
      lastNode.classList.add("slide-exit");
      requestAnimationFrame(()=>lastNode.classList.add("slide-exit-active"));
      setTimeout(()=>{ lastNode.remove(); lastNode=null; },300);
    }
  });
})();
