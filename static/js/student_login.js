// ===============================================
// EMIS Student Login JS
// Handles loading animation + form submission
// ===============================================

document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("studentLoginForm");
    const loginBtn = document.querySelector(".login-btn");
    const btnText = document.querySelector(".btn-text");
    const btnSpinner = document.querySelector(".loading-spinner");
    const loadingOverlay = document.getElementById("loadingOverlay");

    if (!loginForm || !loginBtn) return;

    loginForm.addEventListener("submit", (e) => {
        // Do NOT prevent submission — let Flask handle it
        // Just activate animation before real submit happens

        // Disable button & form
        loginBtn.disabled = true;
        loginBtn.classList.add("loading");

        // Hide text, show spinner
        btnText.classList.add("hidden");
        btnSpinner.classList.remove("hidden");

        // Show overlay loader (optional)
        loadingOverlay.classList.remove("hidden");
    });

});
