import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Same Card/CardHeader/CardContent as SignInCard, so padding and gaps come
// from the real components; only the leaf content is swapped for blocks of
// the same height (title 32px + mb-2, 2 text-sm lines, label 20 + h-9 input,
// remember-me row, h-10 button, footer line).
export function SignInSkeleton() {
  return (
    <Card className="w-full border-none shadow-none ring-0" aria-hidden="true">
      <CardHeader>
        <div className="mb-2 flex h-8 justify-center">
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex h-10 flex-col items-center justify-center gap-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-9 w-full rounded-4xl" />
            </div>
          ))}
          <div className="flex h-5 items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-10 w-full rounded-4xl" />
        </div>
        <div className="mt-4 flex h-5 justify-center">
          <Skeleton className="h-5 w-56" />
        </div>
      </CardContent>
    </Card>
  );
}
