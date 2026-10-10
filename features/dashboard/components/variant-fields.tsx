import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import React from "react";
import { useFieldArray, Control, UseFormSetValue } from "react-hook-form";
import type { ProductFormValues } from "@/features/dashboard/schema";

interface VariantFieldsProps {
  control: Control<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
}

export function VariantFields({ control, setValue }: VariantFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "productVariants",
  });

  return (
    <div className="w-full mt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold">Variants</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: "", price: undefined })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Variant
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-start">
            <FormField
              control={control}
              name={`productVariants.${index}.name`}
              render={({ field: formField }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="Name (e.g. Red, XL)" {...formField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`productVariants.${index}.price`}
              render={({ field: formField }) => (
                <FormItem className="w-32">
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Price"
                      {...formField}
                      value={formField.value || ""}
                      onChange={(e) =>
                        formField.onChange(e.target.value ? Number(e.target.value) : undefined)
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
        <p className="text-sm text-muted-foreground mt-2">No variants added.</p>
      )}
    </div>
  );
}
