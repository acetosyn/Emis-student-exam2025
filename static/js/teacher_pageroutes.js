/* ==========================================================
   EMIS TEACHER PAGE ROUTER — teacher_pageroutes.js (v3)
   ----------------------------------------------------------
   Dynamically loads teacher tools (uploads, results, reports, etc.)
   into #teacherDynamicContent without leaving teachers.html
   ----------------------------------------------------------
   ✳️ Features:
   - Smooth fade-in transitions
   - Loader spinner animation
   - Error fallback panel
   - Active button highlight
   - Scroll-to-view on load
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const dynamicContainer = document.getElementById("teacherDynamicContent");
  const toolButtons = document.querySelectorAll(".module-item[data-page]");

  const loaderHTML = `
    <div class="route-loader fade-in">
      <div class="loader-spinner"></div>
      <p>Loading, please wait...</p>
    </div>
  `;

  toolButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      let page = btn.dataset.page;

      // ✅ Normalize route to ensure valid endpoint
      // If no extension is given, add ".html" for Flask templates
      if (!page.endsWith(".html")) {
        page = `${page}.html`;
      }

      // Highlight active tool visually
      toolButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Show loading animation
      dynamicContainer.innerHTML = loaderHTML;

      try {
        const response = await fetch(`/admin/${page.replace('.html', '')}`);

        if (!response.ok) throw new Error(`Page not found (${response.status})`);

        const html = await response.text();

        // Delay a bit for transition smoothness
        setTimeout(() => {
          dynamicContainer.innerHTML = `
            <div class="fade-slide-in">${html}</div>
          `;
          dynamicContainer.scrollIntoView({ behavior: "smooth" });
        }, 250);
      } catch (error) {
        console.error("❌ Route load error:", error);
        dynamicContainer.innerHTML = `
          <div class="error-panel fade-in">
            <i class="fa-solid fa-triangle-exclamation text-red-500"></i>
            <p>⚠️ Unable to load <strong>${page}</strong><br>
            <small>${error.message}</small></p>
          </div>
        `;
      }
    });
  });

  // Optional dashboard refresh (top-right)
  const refreshBtn = document.getElementById("refreshDashboard");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => location.reload());
  }
});
