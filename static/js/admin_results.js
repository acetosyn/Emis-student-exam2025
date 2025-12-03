/* ============================================================================
   EMIS ADMIN RESULTS CONSOLE — admin_results.js (v3.0)
   Fully dynamic table engine + filtering + analytics + pagination
============================================================================ */

console.log("%c[admin_results.js] Loaded", "color:#0f4; font-weight:bold;");

let RESULTS = [];           // Full dataset loaded from backend
let FILTERED = [];          // After search filter
let CURRENT_PAGE = 1;
const ROWS_PER_PAGE = 10;

const classSelector = document.getElementById("classSelector");
const subjectSelector = document.getElementById("subjectSelector");
const loadBtn = document.getElementById("loadClassResultsBtn");

const searchBox = document.getElementById("globalSearch");
const resultsBody = document.getElementById("resultsBody");
const pagination = document.getElementById("pagination");

const selectAllRows = document.getElementById("selectAllRows");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");

const statTotalResults = document.getElementById("statTotalResults");
const statPassRate = document.getElementById("statPassRate");
const statAvgScore = document.getElementById("statAvgScore");
const statSubjects = document.getElementById("statSubjects");

// Modal
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

/* ============================================================================
   1. LOAD RESULTS FROM BACKEND
============================================================================ */
async function loadResults() {
    const classVal = classSelector.value.trim();
    const subjectVal = subjectSelector.value.trim();

    if (!classVal || !subjectVal) {
        alert("Please select BOTH class and subject.");
        return;
    }

    resultsBody.innerHTML = `
        <tr><td colspan="9" class="no-data">Loading results...</td></tr>
    `;

    try {
        const response = await fetch(`/api/results?class=${classVal}&subject=${subjectVal}`);
        const data = await response.json();

        RESULTS = data.results || [];

        if (RESULTS.length === 0) {
            resultsBody.innerHTML = `
                <tr><td colspan="9" class="no-data">No results available yet</td></tr>
            `;
            updateAnalytics();
            pagination.innerHTML = "";
            return;
        }

        CURRENT_PAGE = 1;
        FILTERED = [...RESULTS];
        renderTable();
        updateAnalytics();

    } catch (err) {
        console.error("Failed to load results:", err);
        resultsBody.innerHTML = `
            <tr><td colspan="9" class="no-data">Error loading results</td></tr>
        `;
    }
}

/* ============================================================================
   2. RENDER TABLE WITH PAGINATION
============================================================================ */
function renderTable() {
    if (!FILTERED.length) {
        resultsBody.innerHTML = `
            <tr><td colspan="9" class="no-data">No results found</td></tr>
        `;
        pagination.innerHTML = "";
        return;
    }

    const start = (CURRENT_PAGE - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const pageRows = FILTERED.slice(start, end);

    resultsBody.innerHTML = pageRows.map((row, index) => `
        <tr>
            <td><input type="checkbox" class="row-check"></td>
            <td>${row["Student Name"] || ""}</td>
            <td>${row["Admission No"] || ""}</td>
            <td>${row["Class"] || ""}</td>
            <td>${row["Subject"] || ""}</td>
            <td>${row["Score (%)"] || ""}</td>
            <td class="${row["Status"] === "PASS" ? "status-pass" : "status-fail"}">
                ${row["Status"]}
            </td>
            <td>${row["Submitted At"] || ""}</td>
            <td><button class="btn-light small">View</button></td>
        </tr>
    `).join("");

    renderPagination();
}

/* ============================================================================
   3. PAGINATION GENERATOR
============================================================================ */
function renderPagination() {
    const totalPages = Math.ceil(FILTERED.length / ROWS_PER_PAGE);

    if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
    }

    let buttons = "";
    for (let i = 1; i <= totalPages; i++) {
        buttons += `
            <button class="${i === CURRENT_PAGE ? "active" : ""}" 
                    onclick="gotoPage(${i})">${i}</button>
        `;
    }

    pagination.innerHTML = buttons;
}

function gotoPage(page) {
    CURRENT_PAGE = page;
    renderTable();
}

/* ============================================================================
   4. LIVE SEARCH FILTER
============================================================================ */
searchBox.addEventListener("input", () => {
    const q = searchBox.value.toLowerCase();

    FILTERED = RESULTS.filter(r =>
        Object.values(r).some(val =>
            String(val).toLowerCase().includes(q)
        )
    );

    CURRENT_PAGE = 1;
    renderTable();
});

/* ============================================================================
   5. SELECT ALL + BULK DELETE  — FULL WORKING VERSION
============================================================================ */

selectAllRows.addEventListener("change", () => {
    const checks = document.querySelectorAll(".row-check");
    checks.forEach(c => c.checked = selectAllRows.checked);
});

deleteSelectedBtn.addEventListener("click", () => {
    const checks = document.querySelectorAll(".row-check:checked");

    if (checks.length === 0) {
        alert("No rows selected.");
        return;
    }

    deleteModal.classList.remove("hidden");
});

confirmDeleteBtn.addEventListener("click", async () => {
    const checks = document.querySelectorAll(".row-check:checked");

    if (checks.length === 0) {
        deleteModal.classList.add("hidden");
        return;
    }

    // Collect selected rows
    const deleteItems = [];
    checks.forEach(chk => {
        const row = chk.closest("tr");
        deleteItems.push({
            "Student Name": row.children[1].textContent.trim().toUpperCase(),
            "Admission No": row.children[2].textContent.trim().toUpperCase()
        });
    });

    // Prepare payload
    const payload = {
        class_category: classSelector.value.trim().toUpperCase(),
        subject: subjectSelector.value.trim().toUpperCase(),
        delete_items: deleteItems
    };

    try {
        const response = await fetch("/api/results/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === "ok") {
            alert("✔ Deleted successfully!");
            deleteModal.classList.add("hidden");
            loadResults(); // Reload from backend
        } else {
            alert("Delete failed: " + (result.error || "Unknown error"));
        }

    } catch (error) {
        console.error("Delete error:", error);
        alert("Server error while deleting results.");
    }
});

/* ============================================================================
   6. CLOSE DELETE MODAL
============================================================================ */
function closeDeleteModal() {
    deleteModal.classList.add("hidden");
}
window.closeDeleteModal = closeDeleteModal;

/* ============================================================================
   7. EXPORT CSV
============================================================================ */
document.getElementById("exportCsvBtn").addEventListener("click", () => {
    if (!FILTERED.length) return alert("No data to export.");

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
   8. PRINT TABLE
============================================================================ */
document.getElementById("printTableBtn").addEventListener("click", () => {
    window.print();
});

/* ============================================================================
   9. REFRESH RESULTS
============================================================================ */
document.getElementById("reloadTableBtn").addEventListener("click", () => {
    loadResults();
});

/* ============================================================================
   10. ANALYTICS UPDATE
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
        let s = parseInt((r["Score (%)"] || "0").replace("%", ""));
        return sum + s;
    }, 0) / RESULTS.length;

    statAvgScore.textContent = `${avg.toFixed(1)}%`;

    statSubjects.textContent = new Set(RESULTS.map(r => r["Subject"])).size;
}

/* ============================================================================
   11. LOAD BUTTON HANDLER
============================================================================ */
loadBtn.addEventListener("click", loadResults);


/* ========================================================================
   ADMIN — PRINT SUMMARY (Same as Student Print Format)
======================================================================== */
function printAdminSummary(i) {
    const row = FILTERED[i];
    if (!row) return;

    // Basic student info
    document.getElementById("ap_studentName").textContent = row["Student Name"] || "--";
    document.getElementById("ap_studentID").textContent = row["Admission No"] || "--";
    document.getElementById("ap_studentClass").textContent = row["Class"] || "--";
    document.getElementById("ap_studentCategory").textContent = classSelector.value || "--";

    // Subject
    document.getElementById("ap_subject").textContent = row["Subject"] || "--";

    // Correct / Total
    const correct = parseInt(row["Correct"] || 0);
    const total = parseInt(row["Total"] || 0);

    // Raw Score e.g. “35 / 50”
    const rawScore = total > 0 ? `${correct} / ${total}` : (row["Score (%)"] || "--");
    document.getElementById("ap_rawScore").textContent = rawScore;

    document.getElementById("ap_correct").textContent = correct || 0;
    document.getElementById("ap_total").textContent = total || 0;

    // Accuracy
    const accuracy = total > 0 ? Math.round((correct / total) * 100) + "%" : "0%";
    document.getElementById("ap_accuracy").textContent = accuracy;

    // Time Taken — NOT in Excel, so mark as "--"
    document.getElementById("ap_time").textContent = "--";

    // Status
    document.getElementById("ap_status").textContent = row["Status"] || "--";

    // Completion date
    document.getElementById("ap_date").textContent = row["Submitted At"] || "--";

    // Show clean summary
    const block = document.getElementById("adminPrintSummary");
    block.style.display = "block";

    window.print();

    // Hide after printing
    setTimeout(() => block.style.display = "none", 400);
}

window.printAdminSummary = printAdminSummary;


/* ========================================================================
   ADMIN — PRINT SUMMARY FOR SELECTED ROW (Top Button)
======================================================================== */
function printAdminSummarySelected() {
    const checks = document.querySelectorAll(".row-check:checked");

    if (checks.length === 0) {
        alert("Please select ONE result to print.");
        return;
    }
    if (checks.length > 1) {
        alert("Select ONLY one row to print.");
        return;
    }

    const row = checks[0].closest("tr");

    // Get correct index inside FILTERED array
    const displayIndex = Array.from(resultsBody.children).indexOf(row);

    printAdminSummary(displayIndex);
}

window.printAdminSummarySelected = printAdminSummarySelected;


/* ============================================================================
   END OF FILE
============================================================================ */
