document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#adminLoginForm");
  const overlay = document.querySelector("#loadingOverlay");

  // ================= PASSWORD TOGGLE =================
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);

      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        btn.innerHTML = `<i class="fas fa-eye-slash"></i>`;
      } else {
        input.type = "password";
        btn.innerHTML = `<i class="fas fa-eye"></i>`;
      }
    });
  });

  // ================= FORM SUBMIT =================
  if (form) {
    form.addEventListener("submit", (e) => {
      const inputs = form.querySelectorAll("input, select");
      let valid = true;

      inputs.forEach(i => {
        if (!i.value.trim()) valid = false;
      });

      if (!valid) {
        e.preventDefault();
        showToast("⚠️ Please fill in all fields", "error");
        return;
      }

      if (overlay) overlay.classList.remove("hidden");
    });
  }

  // ================= TYPEWRITER EFFECT =================
  const el = document.getElementById("typewriter");
  if (el) {
    const messages = [
      "Welcome to EMIS exam Portal",
      "Login below to access your home dashboard",
      "Contact admin for support and assistance"
    ];

    let msgIndex = 0;
    let charIndex = 0;
    let deleting = false;

    // wrap text inside span, keep cursor separate
    const textSpan = document.createElement("span");
    const cursor = document.createElement("span");
    cursor.className = "typewriter-cursor";
    cursor.textContent = "|";

    el.innerHTML = ""; // clear
    el.appendChild(textSpan);
    el.appendChild(cursor);

    function type() {
      const current = messages[msgIndex];
      if (!deleting) {
        textSpan.textContent = current.substring(0, charIndex++);
        if (charIndex > current.length) {
          deleting = true;
          setTimeout(type, 1200); // pause before deleting
          return;
        }
      } else {
        textSpan.textContent = current.substring(0, charIndex--);
        if (charIndex === 0) {
          deleting = false;
          msgIndex = (msgIndex + 1) % messages.length;
        }
      }
      setTimeout(type, deleting ? 40 : 70);
    }

    type();
  }
});

// ================= TOAST FUNCTION =================
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
