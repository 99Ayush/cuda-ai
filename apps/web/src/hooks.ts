import { useCallback, useEffect, useState, type RefObject } from "react";

export type Appearance = "dark" | "light" | "system";
export type ToastItem = { id: number; message: string; tone: "success" | "error" | "info" };

const APPEARANCE_KEY = "verity-appearance";
const LEGACY_APPEARANCE_KEY = "claimlens-appearance";

function storedAppearance(): Appearance {
  try {
    const saved =
      localStorage.getItem(APPEARANCE_KEY) ?? localStorage.getItem(LEGACY_APPEARANCE_KEY);
    return saved === "light" || saved === "system" ? saved : "dark";
  } catch {
    return "dark";
  }
}

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
  const [appearance, setAppearance] = useState<Appearance>(storedAppearance);
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
      localStorage.setItem(APPEARANCE_KEY, appearance);
    } catch {}
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  return { appearance, setAppearance };
}

export function useModalDialog(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog!.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((control) => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog!.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || !dialog!.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog!.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [ref]);
}
