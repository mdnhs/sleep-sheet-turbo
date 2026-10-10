import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Stands in for the category checkbox list in ProductSidebarContent: same
// flex-col gap-3 stack and 20px (text-sm) rows with a 16px checkbox.
function CategoryLoading() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {["w-2/3", "w-1/2", "w-3/4", "w-1/3", "w-3/5"].map((width, i) => (
        <div key={i} className="flex h-5 items-center gap-3">
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <Skeleton className={`h-4 ${width}`} />
        </div>
      ))}
    </div>
  );
}

export default CategoryLoading;
