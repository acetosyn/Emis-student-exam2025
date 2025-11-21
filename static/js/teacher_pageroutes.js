/* ==========================================================
   EMIS TEACHER PAGE ROUTER — teacher_pageroutes.js (v5)
   ----------------------------------------------------------
   Dynamically loads teacher tools (uploads, results, reports, etc.)
   into #teacherDynamicContent without leaving teachers.html

   ✳️ Features:
   - Smooth fade-in transitions
   - Loader spinner animation
   - Error fallback panel
   - Active button highlight
   - Scroll-to-view animation
   - Auto-load module via URL param (?open=uploads)
   - Auto-executes external + inline scripts in loaded HTML
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

  /* ==========================================================
     AUTO LOAD MODULE BASED ON URL PARAM
     Example: /admin/teachers?open=uploads
  ========================================================== */
  const urlParams = new URLSearchParams(window.location.search);
  const moduleToOpen = urlParams.get("open");

  if (moduleToOpen) {
    const targetBtn = document.querySelector(
      `.module-item[data-page="${moduleToOpen}.html"]`
    );

    if (targetBtn) {
      setTimeout(() => {
        targetBtn.click(); // simulate click to load module
      }, 350);
    }
  }

  /* ==========================================================
     BUTTON CLICK HANDLING FOR MODULE LOADING
  ========================================================== */
  toolButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      let page = btn.dataset.page;

      // Normalize expected file format
      if (!page.endsWith(".html")) {
        page = `${page}.html`;
      }

      // Highlight selected module
      toolButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Show loading animation
      dynamicContainer.innerHTML = loaderHTML;

      try {
        const response = await fetch(`/admin/${page.replace(".html", "")}`);
        if (!response.ok) throw new Error(`Page not found (${response.status})`);

        const html = await response.text();

        // Delay to smoothen visual transition
        setTimeout(() => {
          dynamicContainer.innerHTML = `<div class="fade-slide-in">${html}</div>`;
          dynamicContainer.scrollIntoView({ behavior: "smooth" });

          // Reattach external scripts found inside loaded content
          const scriptTags = dynamicContainer.querySelectorAll("script[src]");
          scriptTags.forEach((oldScript) => {
            const newScript = document.createElement("script");
            newScript.src = oldScript.src;
            newScript.async = true;
            document.body.appendChild(newScript);
          });

          // Execute inline scripts
          const inlineScripts = dynamicContainer.querySelectorAll(
            "script:not([src])"
          );
          inlineScripts.forEach((inline) => {
            try {
              eval(inline.textContent);
            } catch (err) {
              console.error("⚠️ Inline script error:", err);
            }
          });
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

  /* ==========================================================
     OPTIONAL DASHBOARD REFRESH BUTTON
  ========================================================== */
  const refreshBtn = document.getElementById("refreshDashboard");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => location.reload());
  }
});
