import { Lock } from "lucide-react";

/** Shown in place of a dashboard page whose tab the user's role doesn't open. */
export function NoTabAccess({ title }: { title: string }) {
  return (
    <div className="m-4 flex flex-col items-center justify-center gap-3 rounded-3xl bg-white p-10 text-center dark:bg-card md:m-6">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-[#F4F4F4] text-muted-foreground dark:bg-gray-700">
        <Lock className="size-5" />
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">No access to {title}</h2>
        <p className="text-sm text-muted-foreground">
          Your role can&apos;t open this page. Ask an administrator if you need it.
        </p>
      </div>
    </div>
  );
}
