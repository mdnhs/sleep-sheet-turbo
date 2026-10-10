import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";
import { InferRequestType } from "hono";

export interface ExpenseFilters {
  from?: string;
  to?: string;
  categoryId?: string;
}

export const useGetExpenseCategories = () => {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const response = await client.api.expenses.categories.$get();
      if (!response.ok) throw new Error("Failed to fetch expense categories");
      const { data } = await response.json();
      return data;
    },
  });
};

type CreateExpenseCategoryRequest = InferRequestType<typeof client.api.expenses.categories.$post>["json"];

export const useCreateExpenseCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (json: CreateExpenseCategoryRequest) => {
      const response = await client.api.expenses.categories.$post({ json });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to create category");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Expense category created successfully");
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create category");
    },
  });
};

export const useGetExpenses = (filters: ExpenseFilters = {}) => {
  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: async () => {
      const response = await client.api.expenses.$get({ query: filters });
      if (!response.ok) throw new Error("Failed to fetch expenses");
      return await response.json();
    },
  });
};

export const useGetExpenseSummary = () => {
  return useQuery({
    queryKey: ["expense-summary"],
    queryFn: async () => {
      const response = await client.api.expenses.summary.$get();
      if (!response.ok) throw new Error("Failed to fetch expense summary");
      return await response.json();
    },
  });
};

type CreateExpenseRequest = InferRequestType<typeof client.api.expenses.$post>["json"];

export const useCreateExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (json: CreateExpenseRequest) => {
      const response = await client.api.expenses.$post({ json });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to create expense");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Expense logged successfully");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log expense");
    },
  });
};

type UpdateExpenseRequest = InferRequestType<typeof client.api.expenses[":id"]["$patch"]>["json"];

export const useUpdateExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, json }: { id: string; json: UpdateExpenseRequest }) => {
      const response = await client.api.expenses[":id"].$patch({ param: { id }, json });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to update expense");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Expense updated successfully");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update expense");
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await client.api.expenses[":id"].$delete({ param: { id } });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to delete expense");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Expense deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete expense");
    },
  });
};
