import { Calendar } from "lucide-react";
import { useRef, type FocusEventHandler } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { formatCalendarDay } from "@/lib/format-date";

interface DateFieldProps {
  /** A calendar day as a date input holds it: `YYYY-MM-DD`, or empty. */
  value: string;
  onChange: (day: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

/**
 * The Figma "Fecha": a calendar icon and the day written out (`14 oct 2026`). The control is a
 * native date input, so the picker and the keyboard come with the browser; while it rests its own
 * text is hidden and the day is drawn in the design's format, and when it has the focus the
 * browser's text comes back so a person can see what they are editing. A click anywhere in the box
 * opens the picker. It takes its id, description and invalid state from the `Field` around it.
 */
export function DateField({ value, onChange, onBlur }: DateFieldProps) {
  const { i18n } = useTranslation();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Input
        className="peer pl-9 text-transparent focus:text-(--color-text-default)"
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onClick={() => {
          try {
            input.current?.showPicker();
          } catch {
            // The browser has no picker to open, or refused one without a user gesture.
          }
        }}
        ref={input}
        type="date"
        value={value}
      />
      <Calendar
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-text-secondary)"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-9 -translate-y-1/2 text-sm text-(--color-text-default) peer-focus:hidden"
      >
        {formatCalendarDay(value, i18n.language)}
      </span>
    </div>
  );
}
