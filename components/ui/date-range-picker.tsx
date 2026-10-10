"use client";

import * as React from "react";
import { format } from "date-fns";
import { IconCalendar, IconX } from "@tabler/icons-react";
import { type DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const hasValue = Boolean(value?.from);

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-start truncate text-left font-normal sm:w-auto sm:flex-none",
                !hasValue && "text-muted-foreground"
              )}
            />
          }
        >
          <IconCalendar data-icon="inline-start" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "LLL d, y")} - {format(value.to, "LLL d, y")}
              </>
            ) : (
              format(value.from, "LLL d, y")
            )
          ) : (
            <span>Custom range</span>
          )}
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-w-[calc(100vw-1.5rem)] p-0"
          align={isMobile ? "center" : "end"}
        >
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={isMobile ? 1 : 2}
          />
          {hasValue && (
            <div className="flex justify-end gap-2 border-t p-2">
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
              {value?.to && (
                <Button size="sm" onClick={() => setOpen(false)}>
                  Apply
                </Button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {hasValue && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Clear date range"
          onClick={handleClear}
        >
          <IconX />
        </Button>
      )}
    </div>
  );
}
