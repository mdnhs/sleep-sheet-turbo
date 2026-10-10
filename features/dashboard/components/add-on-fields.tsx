import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import React from "react";
import { useFieldArray, Control, UseFormSetValue } from "react-hook-form";
import type { ProductFormValues } from "@/features/dashboard/schema";

interface AddOnFieldsProps {
  control: Control<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
}

export function AddOnFields({ control }: AddOnFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "productAddOns",
  });

  return (
    <div className="w-full mt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <label className="block text-sm font-semibold">Add-ons</label>
          <p className="text-xs text-muted-foreground">Optional add-on items (e.g. Curtain per piece, 650 TK)</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: "", price: 0, costPrice: 0 })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Add-on
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-start">
            <FormField
              control={control}
              name={`productAddOns.${index}.name`}
              render={({ field: formField }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="Add-on Title (e.g. Curtain per piece)" {...formField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`productAddOns.${index}.price`}
              render={({ field: formField }) => (
                <FormItem className="w-32">
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Sell Price (TK)"
                      {...formField}
                      value={formField.value ?? ""}
                      onChange={(e) =>
                        formField.onChange(e.target.value ? Number(e.target.value) : 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive shrink-0"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground mt-2">No add-ons added.</p>
      )}
    </div>
  );
}
