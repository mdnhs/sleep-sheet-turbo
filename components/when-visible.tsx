"use client";

import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders `placeholder` until it comes within `rootMargin` of the viewport,
 * then `children`. For below-the-fold sections whose JS, hydration and media
 * shouldn't compete with the first screen on a phone. The placeholder has to
 * take the same height as the real section, or the swap shifts what's below.
 */
export function WhenVisible({
  children,
  placeholder,
  rootMargin = "300px 0px",
}: {
  children: ReactNode;
  placeholder: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (visible || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        // A transition, so mounting the section never blocks a scroll or tap.
        startTransition(() => setVisible(true));
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;
  return <div ref={ref}>{placeholder}</div>;
}
