"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { IconCalendar, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Same string the form already stores: local "yyyy-MM-ddTHH:mm" ("" = no date).
const VALUE_FORMAT = "yyyy-MM-dd'T'HH:mm";

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = parse(value, VALUE_FORMAT, new Date());
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * shadcn Calendar in a popover plus a time input. `defaultTime` is used when a
 * day is picked before any time is set (start of day for a start date, end of
 * day for an end date).
 */
export function DateTimeField({
  value,
  onChange,
  placeholder,
  defaultTime,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  defaultTime: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const date = toDate(value);
  const time = date ? format(date, "HH:mm") : defaultTime;

  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    onChange(`${format(day, "yyyy-MM-dd")}T${time}`);
  };

  const pickTime = (next: string) => {
    if (!date || !next) return;
    onChange(`${format(date, "yyyy-MM-dd")}T${next}`);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn("flex-1 justify-start truncate text-left font-normal", !date && "text-muted-foreground")}
            />
          }
        >
          <IconCalendar data-icon="inline-start" />
          {date ? format(date, "d MMM yyyy, h:mm a") : <span>{placeholder}</span>}
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] p-0" align="start">
          <Calendar mode="single" selected={date} defaultMonth={date} onSelect={pickDay} />
          <div className="flex items-center gap-2 border-t p-2">
            <Input
              type="time"
              aria-label="Time"
              className="h-8 flex-1"
              value={time}
              disabled={!date}
              onChange={(event) => pickTime(event.target.value)}
            />
            <Button type="button" size="sm" disabled={!date} onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {date && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Clear date"
          onClick={() => onChange("")}
        >
          <IconX />
        </Button>
      )}
    </div>
  );
}
