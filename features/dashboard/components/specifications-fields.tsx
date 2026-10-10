import { Control, UseFormSetValue } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash } from "lucide-react";
import { useWatch } from "react-hook-form";
import { ProductFormValues } from "../schema";

interface SpecificationFieldsProps {
  control: Control<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
}

export function SpecificationFields({
  control,
  setValue,
}: SpecificationFieldsProps) {
  const specs = useWatch({ control, name: "specifications" }) || [];

  const addField = () => {
    setValue("specifications", [...specs, { key: "", value: "" }]);
  };

  const updateField = (
    index: number,
    type: "key" | "value",
    newValue: string
  ) => {
    const updated = [...specs];
    updated[index][type] = newValue;
    setValue("specifications", updated);
  };

  const removeField = (index: number) => {
    const updated = [...specs];
    updated.splice(index, 1);
    setValue("specifications", updated);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm font-bold my-4">
        <span>Specifications</span>
        <Button type="button" size="sm" onClick={addField}>
          <Plus className="mr-1" size={16} />
          Add Field
        </Button>
      </div>

      <div className="space-y-4">
        {specs.map((field, index) => (
          <div key={index} className="flex gap-2 items-center">
            <Input
              placeholder="Key"
              value={field.key}
              onChange={(e) => updateField(index, "key", e.target.value)}
              className="w-1/3"
            />
            <Input
              placeholder="Value"
              value={field.value}
              onChange={(e) => updateField(index, "value", e.target.value)}
              className="w-2/3"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeField(index)}
            >
              <Trash size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
