import { cn } from "@/lib/utils";

/**
 * Subtle Linear/Vercel-style grid backdrop. Render as the first child of any
 * `relative` container; it pins to the inset and stays behind content.
 *
 * Two patterns:
 *   - "dot"  — radial dots at 28px intervals (default, for hero / sections)
 *   - "line" — crosshatch at 56px (denser data zones, e.g. dashboard)
 *
 * Color & opacity follow the active theme via `--foreground` mix.
 */
export function BgGrid({
  pattern = "dot",
  className,
}: {
  pattern?: "dot" | "line";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-0",
        pattern === "dot" ? "bg-grid-dot" : "bg-grid-line",
        className
      )}
    />
  );
}

/**
 * Drifting mesh gradient blob — three soft circles in the signal-cyan family,
 * sized to fill the parent and animated via the `mesh-drift` keyframe. Used
 * exclusively in the hero. Pure CSS, no canvas / WebGL, no JS work after mount.
 */
export function MeshGradient({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-0 overflow-hidden",
        className
      )}
    >
      <div
        className="absolute -top-1/4 -left-1/4 size-[60%] rounded-full opacity-40 blur-3xl animate-mesh-drift"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in oklch, var(--signal) 65%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/3 -right-1/4 size-[55%] rounded-full opacity-30 blur-3xl animate-mesh-drift [animation-delay:-6s]"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in oklch, var(--gold) 50%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-1/3 size-[45%] rounded-full opacity-25 blur-3xl animate-mesh-drift [animation-delay:-12s]"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in oklch, var(--signal) 80%, transparent), transparent 70%)",
        }}
      />
    </div>
  );
}
