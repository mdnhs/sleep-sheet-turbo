import React, { Suspense } from "react";
import { Metadata } from "next";
import ExpensesClientPage from "./expenses-client";
import { ExpensesPageSkeleton } from "./expenses-skeleton";

export const metadata: Metadata = {
  title: "Expenses - Dashboard",
  description: "Manage your expenses and categories",
};

export default function ExpensesPage() {
  return (
    <Suspense fallback={<ExpensesPageSkeleton />}>
      <ExpensesClientPage />
    </Suspense>
  );
}
