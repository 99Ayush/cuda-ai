const media = matchMedia("(prefers-color-scheme: light)");
function apply() {
  let preference = "dark";
  try {
    preference = localStorage.getItem("claimlens-appearance") || "dark";
  } catch {}
  document.documentElement.dataset.theme =
    preference === "light" || (preference === "system" && media.matches) ? "light" : "dark";
}
apply();
media.addEventListener("change", apply);
