import { useCallback, useEffect, useState } from "react";
export type Appearance = "dark" | "light" | "system";
export type ToastItem = { id: number; message: string; tone: "success" | "error" | "info" };
export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback((message: string, tone: ToastItem["tone"] = "success") => {
    setItems((current) => [
      ...current.filter((item) => item.message !== message || item.tone !== tone).slice(-2),
      { id: Date.now() + Math.random(), message, tone },
    ]);
  }, []);
  const dismiss = useCallback(
    (id: number) => setItems((current) => current.filter((item) => item.id !== id)),
    [],
  );
  return { items, notify, dismiss };
}
export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try {
      const saved = localStorage.getItem("claimlens-appearance");
      return saved === "light" || saved === "system" ? saved : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const actual = appearance === "system" ? (media.matches ? "light" : "dark") : appearance;
      document.documentElement.dataset.theme = actual;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", actual === "light" ? "#f3f2ec" : "#12211e");
    };
    apply();
    try {
      localStorage.setItem("claimlens-appearance", appearance);
    } catch {}
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  return { appearance, setAppearance };
}
