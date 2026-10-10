import React from "react";
import { Badge } from "./ui/badge";
import { X } from "lucide-react";
import { Input } from "./ui/input";

export const ChipsInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) => {
  const [inputValue, setInputValue] = React.useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (["Enter", ","].includes(e.key)) {
      e.preventDefault();
      const newValue = inputValue.trim();
      if (newValue) {
        onChange([...value, newValue]);
        setInputValue("");
      }
    }
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-wrap gap-2 rounded-md border p-2">
      {value.map((item, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="flex items-center gap-1"
        >
          {item}
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="ml-1 rounded-full hover:bg-accent"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-0 p-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
};
