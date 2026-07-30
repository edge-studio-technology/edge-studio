import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, X } from "lucide-react";
import { cx } from "../lib/cx";

type ToastTone = "error" | "success" | "info" | "warning";
type Toast = { id: string; tone: ToastTone; title: string; message?: string; timeoutMs: number };
type ToastInput = { title: string; message?: string; tone?: ToastTone; timeoutMs?: number };

const ToastContext = createContext<{ showToast: (toast: ToastInput) => void } | null>(null);

type ToastStyle = {
  cardClassName: string;
  tintClassName: string | null;
  titleClassName: string;
  messageClassName: string;
  iconClassName: string;
  closeIconClassName: string;
  closeHoverClassName: string;
};

function toastStyles(tone: ToastTone): ToastStyle {
  switch (tone) {
    case "error":
      return {
        cardClassName: "border border-stroke-error bg-surface-always-white",
        tintClassName: "bg-feedback-error",
        titleClassName: "type-body-em text-text-primary",
        messageClassName: "type-body text-text-secondary",
        iconClassName: "text-icon-primary",
        closeIconClassName: "text-icon-primary",
        closeHoverClassName: "hover:bg-black/5",
      };
    case "warning":
      return {
        cardClassName: "border border-stroke-warning bg-surface-always-white",
        tintClassName: "bg-feedback-warning",
        titleClassName: "type-body-em text-text-primary",
        messageClassName: "type-body text-text-secondary",
        iconClassName: "text-icon-primary",
        closeIconClassName: "text-icon-primary",
        closeHoverClassName: "hover:bg-black/5",
      };
    case "success":
      // Dark
      return {
        cardClassName: "bg-surface-always-black",
        tintClassName: null,
        titleClassName: "type-body-em text-text-inverse",
        messageClassName: "type-body text-grey-03",
        iconClassName: "text-icon-inverse",
        closeIconClassName: "text-icon-inverse",
        closeHoverClassName: "hover:bg-white/10",
      };
    case "info":
    default:
      // Light
      return {
        cardClassName: "border border-stroke-primary bg-surface-always-white",
        tintClassName: null,
        titleClassName: "type-body-em text-text-primary",
        messageClassName: "type-body text-text-secondary",
        iconClassName: "text-icon-primary",
        closeIconClassName: "text-icon-primary",
        closeHoverClassName: "hover:bg-surface-secondary",
      };
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    setMounted(true);
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  function dismissToast(id: string) {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function scheduleDismiss(id: string, timeoutMs: number) {
    const existing = timers.current.get(id);
    if (existing) window.clearTimeout(existing);
    timers.current.set(
      id,
      window.setTimeout(() => dismissToast(id), timeoutMs),
    );
  }

  function pauseDismiss(id: string) {
    const timer = timers.current.get(id);
    if (!timer) return;
    window.clearTimeout(timer);
    timers.current.delete(id);
  }

  function resumeDismiss(id: string) {
    if (timers.current.has(id)) return;
    const toast = toasts.find((item) => item.id === id);
    if (!toast) return;
    scheduleDismiss(id, toast.timeoutMs);
  }

  function showToast({ title, message, tone = "info", timeoutMs = 6000 }: ToastInput) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, title, message, tone, timeoutMs }]);
    scheduleDismiss(id, timeoutMs);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted &&
        createPortal(
          <ToastViewport
            toasts={toasts}
            onDismiss={dismissToast}
            onPause={pauseDismiss}
            onResume={resumeDismiss}
          />,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed right-5 bottom-5 z-[9999] grid w-[min(300px,calc(100vw-40px))] gap-3"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const style = toastStyles(toast.tone);
        const Icon = toast.tone === "success" ? CheckCircle2 : Info;
        return (
          <div
            key={toast.id}
            className={cx(
              "rounded-soft pointer-events-auto relative overflow-clip",
              style.cardClassName,
            )}
            onMouseEnter={() => onPause(toast.id)}
            onMouseLeave={() => onResume(toast.id)}
          >
            {style.tintClassName && (
              <div
                className={cx(
                  "pointer-events-none absolute inset-0 opacity-20",
                  style.tintClassName,
                )}
                aria-hidden
              />
            )}

            <div className="gap-detail-close p-margin-tight relative flex items-start pr-10">
              <div className="grid size-5 shrink-0 place-items-center">
                <Icon size={20} className={style.iconClassName} aria-hidden />
              </div>

              <div className="gap-detail-tight flex min-w-0 flex-1 flex-col">
                <strong className={style.titleClassName}>{toast.title}</strong>
                {toast.message && (
                  <p className={cx("m-0 break-words", style.messageClassName)}>{toast.message}</p>
                )}
              </div>
            </div>

            <button
              className={cx(
                "absolute top-0 right-0 z-10 grid size-9 place-items-center rounded-full bg-transparent",
                style.closeHoverClassName,
              )}
              type="button"
              aria-label="Close notification"
              onClick={() => onDismiss(toast.id)}
            >
              <X size={16} className={style.closeIconClassName} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
