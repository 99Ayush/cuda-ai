import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { View } from "../types";
export default function Commands({
  onClose,
  onView,
  help = false,
}: {
  onClose: () => void;
  onView: (view: View) => void;
  help?: boolean;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="system-dialog"
      aria-labelledby="commands-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="commands-title">{help ? "Keyboard shortcuts" : "Commands"}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close commands">
          <X size={20} />
        </button>
      </div>
      {help ? (
        <ul>
          <li>Ctrl / Command + K: focus claim entry</li>
          <li>Ctrl / Command + Enter: verify</li>
          <li>Ctrl / Command + Shift + P: commands</li>
          <li>?: keyboard help when outside a text field</li>
          <li>Escape: close dialogs</li>
        </ul>
      ) : (
        <div className="command-list">
          {(["check", "history", "stats", "settings"] as const).map((view) => (
            <button
              key={view}
              onClick={() => {
                onView(view);
                onClose();
              }}
            >
              {view === "stats" ? "Statistics" : view[0]!.toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      )}
    </dialog>
  );
}
