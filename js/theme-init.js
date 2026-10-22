// Dijalankan di <head> sebelum CSS supaya tema tidak "berkedip" saat halaman dibuka.
(function () {
  var t;
  try { t = localStorage.getItem("chupichat:theme"); } catch (e) { /* abaikan */ }
  if (t !== "light" && t !== "dark") {
    t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", t);
})();
