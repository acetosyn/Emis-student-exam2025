document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-newtab]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      window.open(link.href, "_blank", "noopener,noreferrer");
      showToast("Opening Students in a new tab...");
    });
  });
});

function showToast(msg) {
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #0f2b46;
    color: #fff;
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 0.9rem;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: fadeOut 2s forwards 2s;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

const style = document.createElement('style');
style.textContent = `
@keyframes fadeOut {
  to { opacity: 0; transform: translateY(10px); }
}`;
document.head.appendChild(style);
