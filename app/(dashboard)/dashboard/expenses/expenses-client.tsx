"use client";

import { useState } from "react";
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs";
import {
  useGetExpenses,
  useGetExpenseCategories,
  useGetExpenseSummary,
  useCreateExpense,
  useUpdateExpense,
  useCreateExpenseCategory,
  useDeleteExpense,
  type ExpenseFilters,
} from "@/features/expenses/api/use-expenses";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfDay, endOfDay, startOfMonth, subDays } from "date-fns";
import { Plus, Trash2, Pencil, Loader2, CalendarDays, Tag, Receipt } from "lucide-react";
import { ConfirmDialog } from "@/components/conform-dialouge";

type DateFilter = "all" | "today" | "week" | "month";

const ALL_CATEGORIES = "all";

export default function ExpensesClientPage() {
  const { formatAmount } = useCurrency();

  const [dateFilter, setDateFilter] = useQueryState("date", parseAsStringEnum<DateFilter>(["all", "today", "week", "month"]).withDefault("all"));
  const [categoryFilter, setCategoryFilter] = useQueryState("category", parseAsString.withDefault(ALL_CATEGORIES));

  const buildDateRange = (type: DateFilter): Pick<ExpenseFilters, "from" | "to"> => {
    const today = new Date();
    switch (type) {
      case "today":
        return {
          from: startOfDay(today).toISOString(),
          to: endOfDay(today).toISOString(),
        };
      case "week":
        return {
          from: startOfDay(subDays(today, 6)).toISOString(),
          to: endOfDay(today).toISOString(),
        };
      case "month":
        return {
          from: startOfMonth(today).toISOString(),
          to: endOfDay(today).toISOString(),
        };
      default:
        return {};
    }
  };

  const filters: ExpenseFilters = {
    ...buildDateRange(dateFilter),
    ...(categoryFilter !== ALL_CATEGORIES ? { categoryId: categoryFilter } : {}),
  };

  const { data: expenseData, isLoading: expensesLoading } = useGetExpenses(filters);
  const { data: categories } = useGetExpenseCategories();
  const { data: summary, isLoading: summaryLoading } = useGetExpenseSummary();

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const createCategory = useCreateExpenseCategory();
  const deleteExpense = useDeleteExpense();

  // State for Add Expense Dialog
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // State for Edit Expense Dialog
  const [editingExpense, setEditingExpense] = useState<NonNullable<typeof expenseData>["data"][number] | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");

  // State for Add Category Dialog
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");

  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  const handleOpenEdit = (expense: NonNullable<typeof expenseData>["data"][number]) => {
    setEditingExpense(expense);
    setEditAmount(expense.amount.toString());
    setEditCategoryId(expense.categoryId);
    setEditNote(expense.note || "");
    setEditDate(format(new Date(expense.date), "yyyy-MM-dd"));
  };

  const handleUpdateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editCategoryId || !editAmount) return;

    updateExpense.mutate(
      {
        id: editingExpense.id,
        json: {
          amount: parseFloat(editAmount),
          categoryId: editCategoryId,
          note: editNote,
          date: editDate,
        },
      },
      {
        onSuccess: () => {
          setEditingExpense(null);
        },
      }
    );
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseCategoryId || !expenseAmount) return;

    createExpense.mutate(
      {
        categoryId: expenseCategoryId,
        amount: parseFloat(expenseAmount),
        note: expenseNote,
        date: expenseDate,
      },
      {
        onSuccess: () => {
          setIsExpenseDialogOpen(false);
          setExpenseAmount("");
          setExpenseNote("");
          setExpenseCategoryId("");
          setExpenseDate(format(new Date(), "yyyy-MM-dd"));
        }
      }
    );
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    createCategory.mutate(
      { name: categoryName.trim() },
      {
        onSuccess: () => {
          setIsCategoryDialogOpen(false);
          setCategoryName("");
        }
      }
    );
  };

  const handleDelete = () => {
    if (deleteExpenseId) {
      deleteExpense.mutate(deleteExpenseId, {
        onSuccess: () => setDeleteExpenseId(null)
      });
    }
  };

  const expenses = expenseData?.data;

  const dateFilterButtons: { type: DateFilter; label: string }[] = [
    { type: "all", label: "All Time" },
    { type: "today", label: "Today" },
    { type: "week", label: "Last 7 Days" },
    { type: "month", label: "This Month" },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Log and manage your business expenses</p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger render={<Button variant="outline" className="gap-2 rounded-full border bg-slate-50 dark:bg-muted/40 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors h-9 px-4 flex-1 sm:flex-none" />}>
              <Plus className="h-4 w-4" />
              Add Category
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Expense Category</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCategory} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Category Name</Label>
                  <Input
                    placeholder="e.g., Packaging, Transport"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createCategory.isPending}>
                    {createCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogTrigger render={<Button className="gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5 h-9 text-xs font-semibold flex-1 sm:flex-none" />}>
              <Plus className="h-4 w-4" />
              Log Expense
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log New Expense</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddExpense} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={expenseCategoryId} onValueChange={(v) => setExpenseCategoryId(v || "")} required>
                    <SelectTrigger className="capitalize">
                      <SelectValue placeholder="Select a category">
                        {expenseCategoryId
                          ? categories?.find((c) => c.id === expenseCategoryId)?.name
                          : "Select a category"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} label={cat.name} className="capitalize">{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={expenseDate}
                    max={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Note (Optional)</Label>
                  <Input
                    placeholder="Brief description"
                    value={expenseNote}
                    onChange={(e) => setExpenseNote(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createExpense.isPending}>
                    {createExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="All-Time Expenses"
          icon={<Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />}
          value={summary ? formatAmount(summary.allTimeTotal) : undefined}
          subtitle={summary ? `${summary.allTimeCount} records` : undefined}
          loading={summaryLoading}
        />
        <SummaryCard
          title="This Month"
          icon={<CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />}
          value={summary ? formatAmount(summary.monthTotal) : undefined}
          subtitle={summary ? `${summary.monthCount} records` : undefined}
          loading={summaryLoading}
        />
        <SummaryCard
          title="Top Category (Month)"
          icon={<Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />}
          value={summary?.topCategory?.name ?? "—"}
          subtitle={summary?.topCategory ? formatAmount(summary.topCategory.total) : "No expenses yet"}
          loading={summaryLoading}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Expense History</h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {dateFilterButtons.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDateFilter(type)}
                  className={cn(
                    "rounded-full text-xs font-semibold px-3.5 h-8 transition-colors cursor-pointer flex items-center justify-center select-none",
                    dateFilter === type
                      ? "bg-slate-900 text-white hover:bg-slate-800 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:hover:text-slate-900"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="w-full sm:w-48">
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v || ALL_CATEGORIES)}>
                <SelectTrigger className="w-full rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8 capitalize">
                  <SelectValue>
                    {categoryFilter === ALL_CATEGORIES
                      ? "All Categories"
                      : categories?.find((c) => c.id === categoryFilter)?.name || "All Categories"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value={ALL_CATEGORIES} label="All Categories" className="capitalize text-xs font-medium">All Categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} label={cat.name} className="capitalize text-xs font-medium">{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div>
          {expensesLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : !expenses || expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No expenses match these filters.</div>
          ) : (
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <Table>
                <TableHeader className="bg-slate-50/70 dark:bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Date</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Category</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Note</TableHead>
                    <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">Amount</TableHead>
                    <TableHead className="w-24 text-right font-bold text-slate-700 dark:text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id} className="hover:bg-slate-50/50 dark:hover:bg-muted/40 whitespace-nowrap">
                      <TableCell className="font-medium text-xs">{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-slate-50 dark:bg-muted/40 capitalize">
                          {expense.category?.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{expense.note || "-"}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-orange-600 dark:text-orange-400">{formatAmount(expense.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(expense)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteExpenseId(expense.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateExpense} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editCategoryId} onValueChange={(v) => setEditCategoryId(v || "")} required>
                <SelectTrigger className="capitalize">
                  <SelectValue placeholder="Select a category">
                    {editCategoryId
                      ? categories?.find((c) => c.id === editCategoryId)?.name
                      : "Select a category"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} label={cat.name} className="capitalize">{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={editDate}
                max={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Input
                placeholder="Brief description"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingExpense(null)}>Cancel</Button>
              <Button type="submit" disabled={updateExpense.isPending}>
                {updateExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteExpenseId}
        onOpenChange={(open) => !open && setDeleteExpenseId(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
      />
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  value,
  subtitle,
  loading,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  value?: string;
  subtitle?: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl bg-white dark:bg-card border-none p-4 sm:p-6 shadow-none flex flex-col justify-between min-h-[120px] sm:min-h-[136px]", className)}>
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">{title}</span>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#FFF7ED] dark:bg-orange-950/40 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <div className="mt-2.5 mb-1">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-base sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-orange-600 dark:text-orange-400 truncate">
              {value ?? "—"}
            </div>
            {subtitle && <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 truncate">{subtitle}</p>}
          </>
        )}
      </div>
    </div>
  );
}
