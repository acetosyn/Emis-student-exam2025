/* ============================================================
   EMIS RESULT ENGINE — result.js (2025 v15)
   ------------------------------------------------------------
   ✔ Confetti for high scores (≥ 70)
   ✔ Animated score ring
   ✔ Animated stat bars under each stat
   ✔ Dynamic PDF Download button
   ✔ Shareable Result Link button
   ✔ Rank Badges (Platinum, Gold, Silver, Bronze)
   ✔ Auto-save exam result → backend
   ✔ Perfect compatibility with redesigned result.html + result.css
   ✔ Clean, modern, optimized animations
===============================================================*/

document.addEventListener("DOMContentLoaded", () => {
    if (!window.resultData || !window.studentData) {
        console.error("❌ Missing resultData or studentData");
        return;
    }

    injectStudentInfo();
    populateResult();
    animateScoreRing(window.resultData.score || 0);
    animateStatBars();
    assignBadge(window.resultData.score);
    addPDFDownloadButton();
    addShareButton();
    sendResultToServer();
    setupBackButton();
    overrideBackNavigation();

    if ((window.resultData.score || 0) >= 70) {
        startConfettiBurst();
    }
});

/* ------------------------------------------------------------
   1. Inject Student Information
-------------------------------------------------------------*/
function injectStudentInfo() {
    const s = window.studentData;

    setText("studentName", s.full_name);
    setText("studentID", s.admission_number);
    setText("studentClass", s.class);
    setText("studentCategory", s.class_category);
    setText("studentSysID", s.id);
}

/* ------------------------------------------------------------
   2. Populate Result Values
-------------------------------------------------------------*/
function populateResult() {
    const r = window.resultData;

    setText("correctAnswers", r.correct);
    setText("totalQuestions", r.total);
    setText("incorrectAnswers", r.total - r.correct);
    setText("answeredQuestions", r.answered);
    setText("skippedQuestions", r.total - r.answered);
    setText("flaggedQuestions", r.flagged || 0);
    setText("tabSwitches", r.tabSwitches || 0);

    // Subject
    setText("subjectName", r.subject);

    // Accuracy %
    const accuracy = r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : 0;
    setText("accuracyRate", accuracy + "%");

    // Time taken
    setText("timeTaken", formatTime(r.time_taken));

    // Avg time per question
    const avg = r.answered > 0 ? Math.round(r.time_taken / r.answered) : 0;
    setText("avgTimePerQuestion", avg + "s");

    // Completion timestamp
    const completion = r.submitted_at
        ? new Date(r.submitted_at).toLocaleString()
        : "--";
    setText("completionDate", completion);

    // Status
    setText("examStatus", r.status || "Completed");

    // Pass/Fail
    const pf = document.getElementById("passFail");
    if (r.score >= 50) {
        pf.textContent = "PASS ✓";
        pf.style.color = "#22d3ee";
    } else {
        pf.textContent = "FAIL ✗";
        pf.style.color = "#f87171";
    }

    // Summary message
    document.getElementById("resultMessage").textContent =
        r.score >= 50
            ? "You passed this exam. Excellent job!"
            : "You failed this exam Unfortuately! Better luck next time.";

    // ⭐⭐⭐ BIG RAW SCORE DISPLAY (Fix for Score: X / Y)
    const rawScoreText = document.getElementById("rawScoreText");
    if (rawScoreText) {
        rawScoreText.textContent = `Score: ${r.correct} / ${r.total}`;
    }
}


/* ------------------------------------------------------------
   3. Score Ring Animation
-------------------------------------------------------------*/
function animateScoreRing(score) {
    const circle = document.getElementById("progressCircle");
    const text = document.getElementById("scoreDisplay");

    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    circle.style.strokeDasharray = `${circumference}`;

    let current = 0;
    const timer = setInterval(() => {
        current++;
        if (current >= score) {
            current = score;
            clearInterval(timer);
        }

        const offset = circumference - (current / 100) * circumference;
        circle.style.strokeDashoffset = offset;
        text.textContent = current + "%";

        if (current >= 90) circle.style.stroke = "#a855f7";
        else if (current >= 80) circle.style.stroke = "#eab308";
        else if (current >= 70) circle.style.stroke = "#22c55e";
        else if (current >= 50) circle.style.stroke = "#f59e0b";
        else circle.style.stroke = "#dc2626";

    }, 14);
}

/* ------------------------------------------------------------
   4. Stat Bar Fill Animation
-------------------------------------------------------------*/
function animateStatBars() {
    const fills = document.querySelectorAll(".stat-bar-fill");

    fills.forEach(bar => {
        bar.style.width = "0%";

        setTimeout(() => {
            const statType = bar.dataset.stat;
            let percent = 50;

            if (statType === "accuracy") percent = window.resultData.correct;
            if (statType === "incorrect") percent = (window.resultData.total - window.resultData.correct);
            if (statType === "tabs") percent = Math.min(window.resultData.tabSwitches * 25, 100);
            if (statType === "time") percent = Math.min(window.resultData.time_taken / 2, 100);

            bar.style.width = Math.min(percent, 100) + "%";
        }, 400);
    });
}

/* ------------------------------------------------------------
   5. Award Performance Badge
-------------------------------------------------------------*/
function assignBadge(score) {
    const badgeSlot = document.getElementById("resultBadgeSlot");
    const badge = document.createElement("div");
    badge.className = "result-badge";

    if (score >= 90) {
        badge.innerHTML = "🏆 Platinum Performer";
        badge.style.background = "#a855f7";
    } else if (score >= 80) {
        badge.innerHTML = "🥇 Gold Level";
        badge.style.background = "#eab308";
    } else if (score >= 70) {
        badge.innerHTML = "🥈 Silver Level";
        badge.style.background = "#6b7280";
    } else if (score >= 50) {
        badge.innerHTML = "🥉 Bronze Level";
        badge.style.background = "#d97706";
    } else {
        badge.innerHTML = "📘 Keep Improving";
        badge.style.background = "#0ea5e9";
    }

    badgeSlot.appendChild(badge);
}

/* ------------------------------------------------------------
   6. Confetti Burst Animation
-------------------------------------------------------------*/
function startConfettiBurst() {
    const end = Date.now() + 2500;

    (function frame() {
        for (let i = 0; i < 6; i++) {
            const conf = document.createElement("div");
            conf.className = "confetti-piece";
            conf.style.left = Math.random() * 100 + "%";
            conf.style.animationDuration = 2 + Math.random() * 3 + "s";
            conf.style.background = randomColor();
            document.body.appendChild(conf);

            setTimeout(() => conf.remove(), 5000);
        }

        if (Date.now() < end) requestAnimationFrame(frame);
    })();
}

function randomColor() {
    const c = ["#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#c084fc"];
    return c[Math.floor(Math.random() * c.length)];
}

/* ------------------------------------------------------------
   7. Save Result to Backend
-------------------------------------------------------------*/
let resultSent = false;

function sendResultToServer() {
    if (resultSent) return;
    resultSent = true;

    fetch("/submit_exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(window.resultData)
    })
        .then(res => res.json())
        .then(d => console.log("Result saved:", d))
        .catch(e => console.error("Backend error:", e));
}

/* ------------------------------------------------------------
   8. PDF Download Button
-------------------------------------------------------------*/
function addPDFDownloadButton() {
    const btn = document.createElement("button");
    btn.className = "btn-secondary pdf-btn";
    btn.innerHTML = `<i class="fa-solid fa-file-pdf"></i> Download PDF`;

    btn.addEventListener("click", () => {
        fillPrintSummary();
        window.print();
    });

    document.querySelector(".result-topbar-actions").appendChild(btn);
}

/* ------------------------------------------------------------
   9. Shareable Result Link
-------------------------------------------------------------*/
function addShareButton() {
    const btn = document.createElement("button");
    btn.className = "btn-light share-btn";
    btn.innerHTML = `<i class="fa-solid fa-share-from-square"></i> Share Result`;

    btn.addEventListener("click", async () => {
        const link = window.location.href;
        try {
            await navigator.clipboard.writeText(link);
            alert("🔗 Result link copied to clipboard!");
        } catch {
            alert("Unable to copy. Share manually:\n" + link);
        }
    });

    document.querySelector(".result-topbar-actions").appendChild(btn);
}

/* ------------------------------------------------------------
   10. Back Button
-------------------------------------------------------------*/
function setupBackButton() {
    document.getElementById("backToDashboardBtn")
        .addEventListener("click", () => {
            window.location.href = "/student_portal";
        });
}

/* ------------------------------------------------------------
   11. Disable Browser Back
-------------------------------------------------------------*/
function overrideBackNavigation() {
    history.pushState(null, "", window.location.href);
    window.onpopstate = () => window.location.href = "/student_portal";
}

/* ------------------------------------------------------------
   Utilities
-------------------------------------------------------------*/
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}



function fillPrintSummary() {
    const r = window.resultData;
    const s = window.studentData;

    document.getElementById("p_studentName").textContent = s.full_name;
    document.getElementById("p_studentID").textContent = s.admission_number;
    document.getElementById("p_studentClass").textContent = s.class;
    document.getElementById("p_studentCategory").textContent = s.class_category;

    document.getElementById("p_subject").textContent = r.subject;
    document.getElementById("p_rawScore").textContent = `${r.correct} / ${r.total}`;
    document.getElementById("p_correct").textContent = r.correct;
    document.getElementById("p_total").textContent = r.total;
    document.getElementById("p_accuracy").textContent =
        r.answered > 0 ? Math.round((r.correct / r.answered) * 100) + "%" : "0%";

    document.getElementById("p_time").textContent = formatTime(r.time_taken);
    document.getElementById("p_status").textContent = r.status;
    document.getElementById("p_date").textContent =
        new Date(r.submitted_at).toLocaleString();
}
