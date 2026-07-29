import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/cx";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

const GAP_PX = 8;
const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 100;
const VIEWPORT_PAD = 8;

const OPPOSITE: Record<TooltipPlacement, TooltipPlacement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const beakPositionClass: Record<TooltipPlacement, string> = {
  top: "bottom-[-4px] left-1/2 -translate-x-1/2",
  bottom: "top-[-4px] left-1/2 -translate-x-1/2",
  left: "right-[-4px] top-1/2 -translate-y-1/2",
  right: "left-[-4px] top-1/2 -translate-y-1/2",
};

/** Two sides of the rotated square so the outline continues into the beak tip. */
const beakBorderClass: Record<TooltipPlacement, string> = {
  top: "border-b border-r",
  bottom: "border-t border-l",
  left: "border-t border-r",
  right: "border-b border-l",
};

type Coords = { top: number; left: number };

function coordsFor(
  placement: TooltipPlacement,
  trigger: DOMRect,
  tip: { width: number; height: number },
  gap: number,
): Coords {
  switch (placement) {
    case "top":
      return {
        top: trigger.top - tip.height - gap,
        left: trigger.left + trigger.width / 2 - tip.width / 2,
      };
    case "bottom":
      return {
        top: trigger.bottom + gap,
        left: trigger.left + trigger.width / 2 - tip.width / 2,
      };
    case "left":
      return {
        top: trigger.top + trigger.height / 2 - tip.height / 2,
        left: trigger.left - tip.width - gap,
      };
    case "right":
      return {
        top: trigger.top + trigger.height / 2 - tip.height / 2,
        left: trigger.right + gap,
      };
  }
}

function fits(coords: Coords, tip: { width: number; height: number }) {
  return (
    coords.top >= VIEWPORT_PAD &&
    coords.left >= VIEWPORT_PAD &&
    coords.top + tip.height <= window.innerHeight - VIEWPORT_PAD &&
    coords.left + tip.width <= window.innerWidth - VIEWPORT_PAD
  );
}

function clampToViewport(coords: Coords, tip: { width: number; height: number }): Coords {
  return {
    top: Math.min(
      Math.max(coords.top, VIEWPORT_PAD),
      window.innerHeight - tip.height - VIEWPORT_PAD,
    ),
    left: Math.min(
      Math.max(coords.left, VIEWPORT_PAD),
      window.innerWidth - tip.width - VIEWPORT_PAD,
    ),
  };
}

function resolvePosition(
  preferred: TooltipPlacement,
  trigger: DOMRect,
  tip: { width: number; height: number },
): Coords & { placement: TooltipPlacement } {
  for (const placement of [preferred, OPPOSITE[preferred]]) {
    const coords = coordsFor(placement, trigger, tip, GAP_PX);
    if (fits(coords, tip)) return { ...coords, placement };
  }
  const coords = clampToViewport(coordsFor(preferred, trigger, tip, GAP_PX), tip);
  return { ...coords, placement: preferred };
}

type TooltipBubbleProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  placement?: TooltipPlacement;
  titleId?: string;
};

function TooltipBubble({
  title,
  body,
  actions,
  placement = "top",
  className,
  role,
  titleId,
  ...props
}: TooltipBubbleProps) {
  return (
    <div
      {...props}
      role={role ?? (actions ? "dialog" : "tooltip")}
      className={cx(
        "border-stroke-secondary bg-surface-always-white gap-detail-close rounded-soft p-margin-tight relative flex max-w-[400px] flex-col border",
        placement === "left" || placement === "right" ? "items-start" : "items-center",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          "border-stroke-secondary bg-surface-always-white pointer-events-none absolute size-2 rotate-45",
          beakPositionClass[placement],
          beakBorderClass[placement],
        )}
      />
      <div className="relative flex w-full flex-col items-start break-words">
        <div id={titleId} className="type-body-em text-text-primary w-full">
          {title}
        </div>
        {body != null ? <div className="type-body text-text-secondary w-full">{body}</div> : null}
      </div>
      {actions ? (
        <div className="gap-detail-next relative flex w-full items-center justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export type TooltipProps = {
  children: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Tooltip / toggletip: trigger + positioned bubble.
 * - No `actions`: hover / focus (tooltip).
 * - With `actions`: click to toggle; Escape / outside click to close (toggletip).
 */
export function Tooltip({
  children,
  title,
  body,
  actions,
  placement = "top",
  className,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
}: TooltipProps) {
  const tipId = useId();
  const titleId = useId();
  const isToggletip = actions != null;
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 });
  const [resolvedPlacement, setResolvedPlacement] = useState(placement);
  const [entered, setEntered] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isOpen = openProp ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (openProp === undefined) setUncontrolledOpen(next);
    },
    [onOpenChange, openProp],
  );

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    closeTimerRef.current = null;
  }, []);

  const openNow = useCallback(() => {
    clearTimers();
    setOpen(true);
  }, [clearTimers, setOpen]);

  const closeNow = useCallback(() => {
    clearTimers();
    setOpen(false);
  }, [clearTimers, setOpen]);

  const openSoft = useCallback(() => {
    clearTimers();
    openTimerRef.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  }, [clearTimers, setOpen]);

  const closeSoft = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearTimers, setOpen]);

  useEffect(() => {
    setMounted(true);
    return clearTimers;
  }, [clearTimers]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const next = resolvePosition(placement, trigger.getBoundingClientRect(), {
      width: tip.offsetWidth,
      height: tip.offsetHeight,
    });
    setCoords({ top: next.top, left: next.left });
    setResolvedPlacement(next.placement);
  }, [placement]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(frame);
      setEntered(false);
    };
  }, [isOpen, updatePosition, title, body, actions]);

  useEffect(() => {
    if (!isOpen) return;
    function onScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen || !isToggletip) return;

    const tip = tipRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = tip
      ? Array.from(
          tip.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
      : [];
    focusables[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNow();
        return;
      }
      if (event.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (tipRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeNow();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, isToggletip, closeNow]);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex max-w-full"
        onMouseEnter={isToggletip ? undefined : openSoft}
        onMouseLeave={isToggletip ? undefined : closeSoft}
        onFocus={isToggletip ? undefined : openNow}
        onBlur={isToggletip ? undefined : closeSoft}
        onClick={
          isToggletip
            ? () => {
                if (isOpen) closeNow();
                else openNow();
              }
            : undefined
        }
        aria-describedby={!isToggletip && isOpen ? tipId : undefined}
        aria-expanded={isToggletip ? isOpen : undefined}
        aria-haspopup={isToggletip ? "dialog" : undefined}
        aria-controls={isToggletip ? tipId : undefined}
      >
        {children}
      </span>
      {mounted && isOpen
        ? createPortal(
            <div
              ref={tipRef}
              style={{ top: coords.top, left: coords.left }}
              className={cx(
                "fixed z-50 transition-opacity duration-200 motion-reduce:transition-none",
                entered ? "opacity-100" : "opacity-0",
              )}
              onMouseEnter={isToggletip ? undefined : openNow}
              onMouseLeave={isToggletip ? undefined : closeSoft}
            >
              <TooltipBubble
                id={tipId}
                title={title}
                body={body}
                actions={actions}
                placement={resolvedPlacement}
                className={className}
                titleId={titleId}
                aria-labelledby={isToggletip ? titleId : undefined}
                aria-modal={isToggletip ? true : undefined}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
