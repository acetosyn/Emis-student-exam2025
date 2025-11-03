// =============================================================
// toggle.js — Sidebar + Header Dropdown (Stable v7, Hover Enabled)
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebarToggle");
  const mainContent = document.querySelector(".main-content");
  const sidebarTitle = document.querySelector(".sidebar-title");
  const logoutText = document.querySelector(".btn-logout span");
  const menuTextSpans = document.querySelectorAll(".sidebar-menu a span");

  let isCollapsed = false;
  let isMobile = window.innerWidth < 768;

  // ===== SIDEBAR TOGGLE =====
  toggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();

    if (isMobile) {
      sidebar.classList.toggle("open");
      sidebar.style.transform = sidebar.classList.contains("open")
        ? "translateX(0)"
        : "translateX(-100%)";
      return;
    }

    isCollapsed = !isCollapsed;
    sidebar.classList.toggle("collapsed", isCollapsed);
    sidebar.style.transition = "width 0.25s ease";
    mainContent.style.transition = "margin-left 0.25s ease";
    sidebar.style.width = isCollapsed ? "4.2rem" : "13rem";
    mainContent.style.marginLeft = isCollapsed ? "4.2rem" : "13rem";

    const display = isCollapsed ? "none" : "inline";
    if (sidebarTitle) sidebarTitle.style.display = display;
    if (logoutText) logoutText.style.display = display;
    menuTextSpans.forEach(span => (span.style.display = display));

    const icon = toggleBtn.querySelector("i");
    if (icon) {
      icon.style.transform = isCollapsed ? "rotate(90deg)" : "rotate(0deg)";
      icon.style.transition = "transform 0.25s ease";
    }
  });

  // ===== RESIZE RESET =====
  window.addEventListener("resize", () => {
    isMobile = window.innerWidth < 768;
    if (isMobile) {
      sidebar.classList.remove("collapsed");
      sidebar.style.width = "13rem";
      sidebar.style.transform = "translateX(-100%)";
      mainContent.style.marginLeft = "0";
    } else {
      sidebar.classList.remove("open");
      sidebar.style.transform = "translateX(0)";
      mainContent.style.marginLeft = isCollapsed ? "4.2rem" : "13rem";
    }
  });

  // ===== HEADER DROPDOWNS (Hover + Click Hybrid) =====
  const modulesBtn = document.getElementById("modulesBtn");
  const modulesMenu = document.getElementById("modulesMenu");
  const notifBtn = document.getElementById("notifBtn");
  const notifMenu = notifBtn?.nextElementSibling;

  // Helper to show/hide menu
  function showMenu(menu) {
    if (!menu) return;
    menu.classList.remove("hidden");
    menu.classList.add("flex", "animate-dropdown");
  }

  function hideMenu(menu) {
    if (!menu) return;
    menu.classList.add("hidden");
    menu.classList.remove("flex");
  }

  // === Hover for Desktop ===
  if (!isMobile) {
    [ [modulesBtn, modulesMenu], [notifBtn, notifMenu] ].forEach(([btn, menu]) => {
      if (btn && menu) {
        btn.addEventListener("mouseenter", () => showMenu(menu));
        btn.addEventListener("mouseleave", () => {
          setTimeout(() => {
            if (!menu.matches(":hover")) hideMenu(menu);
          }, 200);
        });

        menu.addEventListener("mouseleave", () => hideMenu(menu));
        menu.addEventListener("mouseenter", () => showMenu(menu));
      }
    });
  }

  // === Click fallback for Mobile ===
  [ [modulesBtn, modulesMenu], [notifBtn, notifMenu] ].forEach(([btn, menu]) => {
    btn?.addEventListener("click", (e) => {
      if (isMobile) {
        e.stopPropagation();
        const isHidden = menu.classList.contains("hidden");
        document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.add("hidden"));
        if (isHidden) showMenu(menu);
        else hideMenu(menu);
      }
    });
  });

  // === Close on Outside Click (Mobile) ===
  document.addEventListener("click", (e) => {
    if (isMobile) {
      [modulesMenu, notifMenu].forEach(menu => {
        const btn = menu?.previousElementSibling;
        if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
          hideMenu(menu);
        }
      });
    }
  });
});
