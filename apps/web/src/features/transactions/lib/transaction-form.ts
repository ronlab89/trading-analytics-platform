import type { CreateTransactionRequestBody } from "@trading/contracts";
import { z } from "zod";

/** A plain decimal as a person types it: digits with an optional fraction, no sign, no separators. */
const DECIMAL = /^\d+(\.\d+)?$/;

const isPositive = (value: string) => DECIMAL.test(value) && Number(value) > 0;

/** `YYYY-MM-DD`, the value of a date input, and a day that exists (not the 31st of February). */
const isCalendarDay = (value: string) => {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

/**
 * What the new transaction form checks. The inputs are all text, so every rule works on text and
 * the numbers are only built when the body is. The messages are not shown: the form picks its own
 * per field, so they follow the language. The fees are optional; an empty box means none.
 */
export const transactionFormSchema = z.object({
  type: z.string().pipe(z.enum(["BUY", "SELL"])),
  assetId: z.string().trim().min(1),
  executedAt: z.string().refine(isCalendarDay),
  quantity: z.string().trim().refine(isPositive),
  price: z.string().trim().refine(isPositive),
  fees: z
    .string()
    .trim()
    .refine((value) => value === "" || DECIMAL.test(value)),
});

/** What the inputs hold while the user types: all text, the type and the asset empty until chosen. */
export type TransactionFormValues = z.input<typeof transactionFormSchema>;

/** Today as the date input writes it, in the person's own time zone. */
export function todayInputValue(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/** The empty form: the date is today, as the Figma shows it, and nothing else is chosen. */
export function emptyTransactionForm(now: Date): TransactionFormValues {
  return {
    type: "",
    assetId: "",
    executedAt: todayInputValue(now),
    quantity: "",
    price: "",
    fees: "",
  };
}

/**
 * The moment of the transaction. The form asks for a day only: today is recorded at this very
 * moment, and any other day at noon in the person's time zone, so converting to UTC cannot move it
 * to the day before or after.
 */
function executedAtOf(day: string, now: Date): Date {
  if (day === todayInputValue(now)) return now;
  const [year = 0, month = 0, date = 0] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12);
}

/**
 * The request body. The prices and the fees are in the currency of the asset, which the form does
 * not ask for: it comes from the chosen asset. An empty fees box is left out, and the API takes it
 * as zero.
 */
export function toCreateTransactionBody(
  values: z.output<typeof transactionFormSchema>,
  currency: string,
  now: Date,
): CreateTransactionRequestBody {
  const body: CreateTransactionRequestBody = {
    assetId: values.assetId,
    type: values.type,
    quantity: Number(values.quantity),
    price: { amount: values.price, currency },
    executedAt: executedAtOf(values.executedAt, now),
  };
  return values.fees === "" ? body : { ...body, fees: { amount: values.fees, currency } };
}
