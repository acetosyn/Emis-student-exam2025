document.addEventListener("DOMContentLoaded", () => {
  // Handle page routing
  const modules = document.querySelectorAll(".module-item");
  const content = document.getElementById("studentDynamicContent");

  modules.forEach((mod) => {
    mod.addEventListener("click", () => {
      const page = mod.dataset.page;
      content.innerHTML = `
        <div class="route-loader">
          <div class="loader-spinner"></div>
          <p>Loading ${page}...</p>
        </div>`;
      setTimeout(() => {
        window.location.href = page;
      }, 600);
    });
  });
});
