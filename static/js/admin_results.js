/* ============================================================================
   EMIS ADMIN RESULTS CONSOLE — PREMIUM v7.0 (2025)
   YEAR + CLASS + SUBJECT SUPPORT — FULL VERSION (NO FUNCTIONS REMOVED)
============================================================================ */

console.log("%c[admin_results.js] Premium v7.0 Loaded", "color:#22c55e;font-weight:bold;");

/* ============================================================================
   ELEMENTS
============================================================================ */
let RESULTS = [];
let FILTERED = [];
let CURRENT_PAGE = 1;
const ROWS_PER_PAGE = 10;

const yearSelector      = document.getElementById("yearSelector");   
const classSelector     = document.getElementById("classSelector");
const subjectSelector   = document.getElementById("subjectSelector");
const searchBox         = document.getElementById("globalSearch");

const loadBtn           = document.getElementById("loadClassResultsBtn");
const resultsBody       = document.getElementById("resultsBody");
const pagination        = document.getElementById("pagination");

const selectAllRows     = document.getElementById("selectAllRows");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");

const deleteModal       = document.getElementById("deleteModal");
const confirmDeleteBtn  = document.getElementById("confirmDeleteBtn");

const statTotalResults  = document.getElementById("statTotalResults");
const statPassRate      = document.getElementById("statPassRate");
const statAvgScore      = document.getElementById("statAvgScore");
const statSubjects      = document.getElementById("statSubjects");

/* ============================================================================
   TOAST SYSTEM
============================================================================ */
function showToast(msg, type = "info") {
    const box = document.createElement("div");
    box.className = `toast toast-${type}`;
    box.textContent = msg;
    document.body.appendChild(box);

    setTimeout(() => box.classList.add("show"), 10);
    setTimeout(() => box.classList.remove("show"), 3000);
    setTimeout(() => box.remove(), 3400);
}

/* ============================================================================
   SHIMMER LOADING
============================================================================ */
function showShimmer() {
    resultsBody.innerHTML = `
        <tr>
            <td colspan="9">
                <div class="shimmer-wrapper"><div class="shimmer"></div></div>
            </td>
        </tr>
    `;
}

/* ============================================================================
   DYNAMIC SUBJECT LOADING — NOW YEAR + CLASS
============================================================================ */
classSelector.addEventListener("change", async () => {
    const year = yearSelector.value.trim();
    const cls  = classSelector.value.trim();

    if (!year) return showToast("Select a YEAR first.", "error");
    if (!cls) return;

    subjectSelector.innerHTML = `<option>Loading…</option>`;

    const res  = await fetch(`/api/results/subjects?year=${year}&class=${cls}`);
    const data = await res.json();

    subjectSelector.innerHTML = `<option value="">-- Select Subject --</option>`;
    (data.subjects || []).forEach(sub => {
        subjectSelector.innerHTML += `<option value="${sub}">${sub}</option>`;
    });

    showToast("Subjects updated ✔", "success");
});

/* ============================================================================
   LOAD RESULTS — NOW YEAR + CLASS + SUBJECT
============================================================================ */
async function loadResults() {
    const year = yearSelector.value.trim();
    const cls  = classSelector.value.trim();
    const sub  = subjectSelector.value.trim();

    if (!year || !cls || !sub) {
        showToast("Select Year, Class & Subject.", "error");
        return;
    }

    showShimmer();

    try {
        const url = `/api/results/load?year=${year}&class=${encodeURIComponent(cls)}&subject=${encodeURIComponent(sub)}`;

        const response = await fetch(url);
        const data = await response.json();

        RESULTS = data.results || [];

        if (!RESULTS.length) {
            resultsBody.innerHTML = `<tr><td colspan="9" class="no-data">No results found</td></tr>`;
            pagination.innerHTML = "";
            updateAnalytics();
            return;
        }

        FILTERED = [...RESULTS];
        CURRENT_PAGE = 1;

        renderTable();
        updateAnalytics();
        showToast("Results loaded ✔", "success");

    } catch (err) {
        console.error(err);
        resultsBody.innerHTML = `<tr><td colspan="9" class="no-data">Server error while loading results</td></tr>`;
        showToast("Error loading results.", "error");
    }
}

/* ============================================================================
   RENDER TABLE — UNCHANGED
============================================================================ */
function renderTable() {
    if (!FILTERED.length) {
        resultsBody.innerHTML = `<tr><td colspan="9" class="no-data">No results match your search</td></tr>`;
        pagination.innerHTML = "";
        return;
    }

    const start = (CURRENT_PAGE - 1) * ROWS_PER_PAGE;
    const rows  = FILTERED.slice(start, start + ROWS_PER_PAGE);

    resultsBody.innerHTML = rows.map((row, i) => `
        <tr class="fade-row">
            <td><input type="checkbox" class="row-check"></td>
            <td>${row["Student Name"]}</td>
            <td>${row["Admission No"]}</td>
            <td>${row["Class"]}</td>
            <td>${row["Subject"]}</td>
            <td>${row["Score (%)"]}</td>
            <td class="${row["Status"] === "PASS" ? "status-pass" : "status-fail"}">${row["Status"]}</td>
            <td>${row["Submitted At"]}</td>
            <td>
                <button class="btn-light small view-btn" data-index="${start + i}">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join("");

    renderPagination();
}

/* ============================================================================
   PAGINATION — UNCHANGED
============================================================================ */
function renderPagination() {
    const pages = Math.ceil(FILTERED.length / ROWS_PER_PAGE);

    if (pages <= 1) {
        pagination.innerHTML = "";
        return;
    }

    pagination.innerHTML = Array.from({ length: pages }).map((_, i) => `
        <button class="page-btn ${i + 1 === CURRENT_PAGE ? "active" : ""}"
                onclick="gotoPage(${i + 1})">${i + 1}</button>
    `).join("");
}

function gotoPage(pg) {
    CURRENT_PAGE = pg;
    renderTable();
}

/* ============================================================================
   SEARCH FILTER — UNCHANGED
============================================================================ */
searchBox.addEventListener("input", () => {
    const q = searchBox.value.toLowerCase();

    FILTERED = RESULTS.filter(r =>
        Object.values(r).some(v => String(v).toLowerCase().includes(q))
    );

    CURRENT_PAGE = 1;
    renderTable();
});

/* ============================================================================
   AUTO LOAD WHEN SUBJECT CHANGES — UNCHANGED
============================================================================ */
subjectSelector.addEventListener("change", loadResults);

/* ============================================================================
   UPDATE ANALYTICS — UNCHANGED
============================================================================ */
function updateAnalytics() {
    if (!RESULTS.length) {
        statTotalResults.textContent = 0;
        statPassRate.textContent = "0%";
        statAvgScore.textContent = "0%";
        statSubjects.textContent = 0;
        return;
    }

    statTotalResults.textContent = RESULTS.length;

    const passes = RESULTS.filter(r => r["Status"] === "PASS").length;
    statPassRate.textContent = `${((passes / RESULTS.length) * 100).toFixed(1)}%`;

    const avg = RESULTS.reduce((sum, r) => {
        const s = parseInt(String(r["Score (%)"] || "0").replace("%", ""));
        return sum + s;
    }, 0) / RESULTS.length;

    statAvgScore.textContent = `${avg.toFixed(1)}%`;
    statSubjects.textContent = new Set(RESULTS.map(r => r["Subject"])).size;
}

/* ============================================================================
   SELECT ALL — UNCHANGED
============================================================================ */
selectAllRows.addEventListener("change", () => {
    document.querySelectorAll(".row-check").forEach(c => c.checked = selectAllRows.checked);
});

/* ============================================================================
   DELETE MODAL — UNCHANGED
============================================================================ */
deleteSelectedBtn.addEventListener("click", () => {
    const selected = document.querySelectorAll(".row-check:checked").length;
    if (!selected) return showToast("No rows selected.", "error");

    deleteModal.classList.remove("hidden");
});

function closeDeleteModal() {
    deleteModal.classList.add("hidden");
}
window.closeDeleteModal = closeDeleteModal;

/* ============================================================================
   CONFIRM DELETE — UPDATED FOR YEAR
============================================================================ */
confirmDeleteBtn.addEventListener("click", async () => {
    const checks = document.querySelectorAll(".row-check:checked");
    if (!checks.length) return closeDeleteModal();

    const payload = {
        year: yearSelector.value.trim(),
        class_category: classSelector.value.trim().toUpperCase(),
        subject: subjectSelector.value.trim().toUpperCase(),
        delete_items: Array.from(checks).map(chk => {
            const tr = chk.closest("tr");
            return {
                "Student Name": tr.children[1].textContent.trim(),
                "Admission No": tr.children[2].textContent.trim()
            };
        })
    };

    try {
        const res = await fetch("/api/results/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const out = await res.json();

        if (out.status === "ok") {
            showToast("Deleted ✔", "success");
            closeDeleteModal();
            loadResults();
        } else {
            showToast("Delete failed.", "error");
        }

    } catch (err) {
        console.error(err);
        showToast("Server error during deletion.", "error");
    }
});

/* ============================================================================
   EXPORT CSV — UNCHANGED
============================================================================ */
document.getElementById("exportCsvBtn").addEventListener("click", () => {
    if (!FILTERED.length) return showToast("No data to export.", "error");

    let csv = "Student,Admission,Class,Subject,Score,Status,Date\n";

    FILTERED.forEach(r => {
        csv += `${r["Student Name"]},${r["Admission No"]},${r["Class"]},${r["Subject"]},${r["Score (%)"]},${r["Status"]},${r["Submitted At"]}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.click();
});

/* ============================================================================
   SUMMARY FILLER — FINAL VERSION WITH TIME TAKEN FIX (2025)
============================================================================ */
function fillSummary(i) {
    const row = FILTERED[i];
    if (!row) return;

    // Basic Info
    document.getElementById("ap_studentName").textContent = row["Student Name"];
    document.getElementById("ap_studentID").textContent = row["Admission No"];
    document.getElementById("ap_studentClass").textContent = row["Class"];
    document.getElementById("ap_studentCategory").textContent = classSelector.value;

    document.getElementById("ap_subject").textContent = row["Subject"];

    // Score / Correct / Total
    const correct = parseInt(row["Correct"] || 0);
    const total   = parseInt(row["Total"] || 0);

    const raw = total ? `${correct} / ${total}` : (row["Score (%)"] || "--");

    document.getElementById("ap_rawScore").textContent = raw;
    document.getElementById("ap_correct").textContent  = correct;
    document.getElementById("ap_total").textContent    = total;

    // Accuracy %
    document.getElementById("ap_accuracy").textContent =
        total > 0 ? `${Math.round((correct / total) * 100)}%` : "0%";

    /* ============================================================================
       TIME TAKEN — READ FROM EITHER:
       - SQLite     → "time_taken"
       - Excel new  → "Time Taken"
       - Excel old  → missing → show "--"
    ============================================================================ */
    let timeTaken = row["time_taken"];

    if (timeTaken === undefined || timeTaken === null || timeTaken === "") {
        timeTaken = row["Time Taken"];  // Excel column
    }

    // If still missing, show "--"
    const formattedTime = 
        (timeTaken !== undefined && timeTaken !== null && timeTaken !== "")
            ? formatTimeAdmin(timeTaken)
            : "--";

    document.getElementById("ap_time").textContent = formattedTime;

    // Final metadata
    document.getElementById("ap_status").textContent = row["Status"];
    document.getElementById("ap_date").textContent   = row["Submitted At"];
}


/* ============================================================================
   FORMAT TIME (seconds → M:SS)
============================================================================ */
function formatTimeAdmin(seconds) {
    seconds = parseInt(seconds || 0);

    // Negative or invalid → fallback
    if (isNaN(seconds) || seconds < 0) return "--";

    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");

    return `${m}:${s}`;
}

/* ============================================================================
   VIEW SUMMARY MODAL — UNCHANGED
============================================================================ */
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-btn");
    if (!btn) return;

    const index = parseInt(btn.dataset.index);
    fillSummary(index);

    const modal    = document.getElementById("adminPrintSummary");
    const overlay  = document.getElementById("summaryOverlay");

    overlay.style.display = "block";
    modal.style.display   = "block";
    modal.classList.add("show-summary");
});

/* ============================================================================
   CLOSE SUMMARY MODAL — UNCHANGED
============================================================================ */
function closeSummary() {
    const modal   = document.getElementById("adminPrintSummary");
    const overlay = document.getElementById("summaryOverlay");

    modal.style.display = "none";
    modal.classList.remove("show-summary");
    overlay.style.display = "none";
}
window.closeSummary = closeSummary;

/* ============================================================================
   CLOSE OVERLAY CLICK — UNCHANGED
============================================================================ */
document.getElementById("summaryOverlay").addEventListener("click", () => {
    closeSummary();
});

/* ============================================================================
   PRINT SUMMARY — UNCHANGED
============================================================================ */
function printAdminSummary(i) {
    const row = FILTERED[i];
    if (!row) return;

    document.getElementById("ap_studentName").textContent   = row["Student Name"] || "--";
    document.getElementById("ap_studentID").textContent     = row["Admission No"] || "--";
    document.getElementById("ap_studentClass").textContent  = row["Class"] || "--";
    document.getElementById("ap_studentCategory").textContent = classSelector.value || "--";

    document.getElementById("ap_subject").textContent = row["Subject"] || "--";

    const correct  = parseInt(row["Correct"] || 0);
    const total    = parseInt(row["Total"] || 0);
    const rawScore = total > 0 ? `${correct} / ${total}` : (row["Score (%)"] || "--");

    document.getElementById("ap_rawScore").textContent = rawScore;
    document.getElementById("ap_correct").textContent  = correct;
    document.getElementById("ap_total").textContent    = total;
    document.getElementById("ap_accuracy").textContent =
        total > 0 ? Math.round((correct / total) * 100) + "%" : "0%";

    document.getElementById("ap_time").textContent   = "--";
    document.getElementById("ap_status").textContent = row["Status"] || "--";
    document.getElementById("ap_date").textContent   = row["Submitted At"] || "--";

    const block = document.getElementById("adminPrintSummary");
    block.classList.remove("show-summary");
    block.style.display = "block";

    window.print();

    setTimeout(() => { block.style.display = "none"; }, 200);
}
window.printAdminSummary = printAdminSummary;

/* ============================================================================
   PRINT SELECTED — UNCHANGED
============================================================================ */
function printAdminSummarySelected() {
    const checks = document.querySelectorAll(".row-check:checked");

    if (checks.length === 0) return alert("Please select ONE result to print.");
    if (checks.length > 1)  return alert("Select ONLY one row to print.");

    const row = checks[0].closest("tr");
    const displayIndex = Array.from(resultsBody.children).indexOf(row);

    printAdminSummary(displayIndex);
}
window.printAdminSummarySelected = printAdminSummarySelected;

/* ============================================================================
   PRINT ALL & EXPORT ALL — UNCHANGED
============================================================================ */
document.getElementById("printSelectedBtn")?.addEventListener("click", printAdminSummarySelected);

document.getElementById("printAllPdfBtn")?.addEventListener("click", () => {
    const tableHTML = document.querySelector(".results-table").outerHTML;

    const w = window.open("", "_blank");
    w.document.write(`
        <html>
        <head>
            <title>All Results</title>
            <style>
                table { width:100%; border-collapse: collapse; font-size:14px; }
                th, td { border:1px solid #ccc; padding:8px; }
            </style>
        </head>
        <body>${tableHTML}</body>
        </html>
    `);
    w.document.close();
    w.print();
});

document.getElementById("exportAllExcelBtn")?.addEventListener("click", () => {
    if (!FILTERED.length) return showToast("No data to export.", "error");

    let csv = "Student,Admission,Class,Subject,Score,Status,Date\n";

    FILTERED.forEach(r => {
        csv += `${r["Student Name"]},${r["Admission No"]},${r["Class"]},${r["Subject"]},${r["Score (%)"]},${r["Status"]},${r["Submitted At"]}\n`;
    });

    const blob = new Blob([csv], { type:"application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "all_results.xls";
    link.click();
});


/* ============================================================================
   CLEAR FILTERS BUTTON
============================================================================ */
document.getElementById("clearFiltersBtn").addEventListener("click", () => {

    // Reset all filters
    yearSelector.value = "";
    classSelector.value = "";
    subjectSelector.innerHTML = `<option value="">-- Select Subject --</option>`;
    searchBox.value = "";

    // Reset table
    resultsBody.innerHTML = `
        <tr>
            <td colspan="9" class="table-placeholder">
                Select Year, Class, and Subject to view results
            </td>
        </tr>
    `;

    // Reset analytics
    statTotalResults.textContent = 0;
    statPassRate.textContent = "0%";
    statAvgScore.textContent = "0%";
    statSubjects.textContent = 0;

    FILTERED = [];
    RESULTS = [];
    pagination.innerHTML = "";

    showToast("Filters cleared ✔", "success");
});

