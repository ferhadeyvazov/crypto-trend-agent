import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Mockup-un `.btn.primary-stop` (amber) / `.btn.primary-start` (yaşıl) ayrımı. */
  variant: "stop" | "start";
  onConfirm: () => void;
  onCancel: () => void;
}

/** Mockup-un overlay/dialog davranışı: Esc bağlayır, backdrop-a klik bağlayır, açılanda Cancel-ə fokus düşür. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[rgba(4,8,18,.7)] p-5 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-[400px] rounded-[14px] border border-border bg-panel p-[22px]">
        <h3 id="confirm-dialog-title" className="mb-2 text-base">
          {title}
        </h3>
        <p className="mb-[18px] text-[13px] text-muted">{description}</p>
        <div className="flex justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-10 rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-10 rounded-lg border px-4 py-2 text-[13px] font-semibold text-bg transition-[filter] hover:brightness-[1.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg focus-visible:outline-offset-2 ${
              variant === "stop" ? "border-amber bg-amber" : "border-green bg-green"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
