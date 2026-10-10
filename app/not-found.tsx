import { buttonVariants } from "@/components/ui/button-variants";

// Plain markup (no Button/next/link): a not-found element is rendered into the
// RSC payload of every page beneath it, so any client component referenced
// here would load with every page, not just on a 404.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      {/* Plain <a>, not next/link — see above. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className={buttonVariants()}>
        Go home
      </a>
    </div>
  );
}
