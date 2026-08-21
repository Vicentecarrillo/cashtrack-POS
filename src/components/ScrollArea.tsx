import React, { useEffect, useRef } from "react";

function useFancyScrollbars(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeout: any;

    const show = () => {
      el.classList.add("show-scrollbar");
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        el.classList.remove("show-scrollbar");
      }, 1000);
    };

    // Listen to both axes
    el.addEventListener("scroll", show, { passive: true });

    return () => {
      el.removeEventListener("scroll", show);
      clearTimeout(timeout);
    };
  }, [ref]);
}

type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function ScrollArea({ children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFancyScrollbars(ref);

  return (
    <div ref={ref} className={`scrollable overflow-auto ${className}`}>
      {children}
    </div>
  );
}
