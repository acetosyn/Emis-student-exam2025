// =============================================================
// EMIS Admin Login Script — v7 (Dynamic Circle Loader + Message + Redirect)
// Handles: Password toggle, Validation, Overlay, Toast, Typewriter
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  const overlay = document.getElementById("loadingOverlay");

  // =========================================================
  // PASSWORD TOGGLE
  // =========================================================
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.innerHTML = isHidden
        ? '<i class="fas fa-eye-slash"></i>'
        : '<i class="fas fa-eye"></i>';
    });
  });

  // =========================================================
  // FORM SUBMIT HANDLER
  // =========================================================
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const inputs = form.querySelectorAll("input[required]");
      let valid = true;

      inputs.forEach((input) => {
        if (!input.value.trim()) valid = false;
      });

      if (!valid) {
        showToast("⚠️ Please fill in all fields", "error");
        return;
      }

      // Show dynamic circular overlay
      if (overlay) {
        overlay.classList.remove("hidden");
        overlay.innerHTML = `
          <div class="loading-box glassy">
            <div class="dynamic-loader">
              <div class="outer-circle"></div>
              <div class="inner-circle"></div>
            </div>
            <p class="loading-text">Authenticating... please wait</p>
          </div>
        `;
      }

      // Simulate short delay before redirect
      setTimeout(() => {
        showToast("✅ Login successful! Redirecting...", "success");

        // Redirect to admin.html
        setTimeout(() => {
          window.location.href = "admin.html";
        }, 1200);
      }, 2000);
    });
  }

  // =========================================================
  // TYPEWRITER EFFECT
  // =========================================================
  const el = document.getElementById("typewriter");
  if (el) {
    const messages = [
      "Welcome to EMIS Exam Portal",
      "Login below to access your dashboard",
      "Empowering academic excellence with technology"
    ];

    let msgIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const textSpan = document.createElement("span");
    const cursor = document.createElement("span");
    cursor.className = "typewriter-cursor";
    cursor.textContent = "|";
    el.innerHTML = "";
    el.appendChild(textSpan);
    el.appendChild(cursor);

    const type = () => {
      const message = messages[msgIndex];
      if (!deleting) {
        textSpan.textContent = message.substring(0, charIndex++);
        if (charIndex > message.length) {
          deleting = true;
          setTimeout(type, 1000);
          return;
        }
      } else {
        textSpan.textContent = message.substring(0, charIndex--);
        if (charIndex === 0) {
          deleting = false;
          msgIndex = (msgIndex + 1) % messages.length;
        }
      }
      setTimeout(type, deleting ? 40 : 70);
    };

    type();
  }
});

// =============================================================
// TOAST NOTIFICATION SYSTEM
// =============================================================
function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
