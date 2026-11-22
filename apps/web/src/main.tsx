import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./design-tokens.css";
import "./index.css";
import "./dashboard.css";
import "./polish.css";
import "./product.css";
try {
  const preference = localStorage.getItem("claimlens-appearance");
  document.documentElement.dataset.theme =
    preference === "light" ||
    (preference === "system" && matchMedia("(prefers-color-scheme: light)").matches)
      ? "light"
      : "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
