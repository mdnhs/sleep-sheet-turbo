"use client";

import { cloneElement, useEffect, useState, type ReactElement, type ReactNode } from "react";

type TooltipModule = typeof import("@/components/ui/tooltip");

// One import for every instance, started by the first one that needs it.
let tooltipModule: Promise<TooltipModule> | null = null;
const loadTooltip = () => (tooltipModule ??= import("@/components/ui/tooltip"));

/**
 * A hover tooltip whose code loads only where it can be used. The navbar's
 * tooltips are desktop-only, but a static import shipped base-ui's Tooltip and
 * floating-ui positioning stack to every phone in the shared layout JS. Here
 * the trigger renders bare first (and stays bare on touch screens); on a
 * device that can hover, the tooltip module loads after mount and wraps it.
 */
export function LazyTooltip({
  label,
  render,
  children,
}: {
  label: ReactNode;
  /** The trigger element, as for TooltipTrigger's `render`. */
  render: ReactElement<{ children?: ReactNode }>;
  children: ReactNode;
}) {
  const [ui, setUi] = useState<TooltipModule | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let cancelled = false;
    void loadTooltip().then((mod) => {
      if (!cancelled) setUi(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ui) return cloneElement(render, undefined, children);

  const { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } = ui;
  // Its own provider: the app-wide one is gone from the root layout (it was
  // what pulled this module in statically), and the provider is what sets the
  // instant (delay 0) opening these had.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={render}>{children}</TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
