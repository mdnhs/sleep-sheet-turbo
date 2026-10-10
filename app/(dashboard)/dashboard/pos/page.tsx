import React, { Suspense } from "react";
import { PosSkeleton } from "./pos-skeleton";
import PosClientPage from "./pos-client";

export const metadata = {
  title: "POS - Point of Sale",
};

function PosPage() {
  return (
    <Suspense fallback={<PosSkeleton />}>
      <PosClientPage />
    </Suspense>
  );
}

export default PosPage;
