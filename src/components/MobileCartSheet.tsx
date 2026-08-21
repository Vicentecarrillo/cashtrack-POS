import * as React from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

// Tune these if you like
const CLOSE_DRAG_PX = 120; // drag distance to close
const MAX_DRAG_PX = 320; // clamp so it doesn't fly away
const SPRING_MS = 180; // snap-back / close animation

export default function MobileCartSheet({ open, onClose, children }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);
  const startYRef = React.useRef(0);
  const draggingRef = React.useRef(false);
  const sheetRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  // Lock body scroll while open
  React.useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, mounted]);

  const onPointerDown = (e: React.PointerEvent) => {
    // Only left/touch
    if (e.button !== 0 && e.pointerType !== "touch") return;
    draggingRef.current = true;
    startYRef.current = e.clientY;
    setAnimating(false);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dy = Math.max(
      0,
      Math.min(MAX_DRAG_PX, e.clientY - startYRef.current)
    );
    setDragY(dy);
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    if (dragY > CLOSE_DRAG_PX) {
      // Animate down then close
      setAnimating(true);
      setDragY(MAX_DRAG_PX);
      window.setTimeout(() => {
        setAnimating(false);
        setDragY(0);
        onClose();
      }, SPRING_MS);
    } else {
      // Snap back up
      setAnimating(true);
      setDragY(0);
      window.setTimeout(() => setAnimating(false), SPRING_MS);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`md:hidden fixed inset-0 z-[100] ${open ? "" : "hidden"}`}
      aria-hidden={!open}
    >
      {/* overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        style={{
          maxHeight: "90vh",
          transform: `translateY(${dragY}px)`,
          transition: animating ? `transform ${SPRING_MS}ms ease` : "none",
        }}
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border p-4
                   border-slate-200 bg-white
                   dark:border-slate-700 dark:bg-slate-900"
      >
        {/* drag handle / header — capture drag here only */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // prevent the browser from interpreting drags as scroll on the handle
          className="select-none touch-none pb-10"
        >
          <div className="mx-auto h-1 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* content area remains scrollable */}
        <div className="max-h-[80vh] overflow-auto pr-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
