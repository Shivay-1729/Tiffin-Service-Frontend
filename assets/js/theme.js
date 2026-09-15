let theme;
try { theme = localStorage.getItem("tiffin-theme"); } catch {}
document.documentElement.dataset.theme = theme ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.addEventListener("click", event => {
  if (!event.target.closest("[data-theme-toggle]")) return;
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("tiffin-theme", next); } catch {}
});
