import { z } from 'zod';
import { isIsoDate } from './dates';
import { MEALS } from './types';

/** Common shape returned by form actions (works with React's useActionState). */
export interface FormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
  /** Changes on every successful submit so clients can react (e.g. close a modal). */
  nonce?: number;
}

export const formValues = (fd: FormData): Record<string, string> =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string') as [string, string][]);

export function failure(error: z.ZodError, fd: FormData): FormState {
  return { fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>, values: formValues(fd) };
}

const blankToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);

export const requiredNumber = (label: string, min: number, max: number) =>
  z.preprocess(
    blankToUndefined,
    z.coerce.number({ error: `${label} is required.` })
      .refine(Number.isFinite, `${label} must be a number.`)
      .refine((v) => v >= min && v <= max, `${label} must be between ${min} and ${max}.`),
  );

export const optionalNumber = (label: string, min: number, max: number) =>
  z.preprocess(
    blankToUndefined,
    z.coerce.number()
      .refine(Number.isFinite, `${label} must be a number.`)
      .refine((v) => v >= min && v <= max, `${label} must be between ${min} and ${max}.`)
      .optional(),
  );

export const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters.`).transform((v) => v || null);

export const isoDate = z.string().refine(isIsoDate, 'Invalid date.');

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

export const entrySchema = z.object({
  id: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  date: isoDate,
  meal: z.enum(MEALS, 'Choose a meal.'),
  name: z.string().trim().min(1, 'Food name is required.').max(120, 'Food name must be at most 120 characters.'),
  brand: optionalText(80, 'Brand').optional().default(null),
  barcode: z.preprocess(blankToUndefined, z.string().regex(/^\d{6,14}$/, 'Barcodes must be 6-14 digits.').optional()),
  servingDescription: optionalText(60, 'Serving size').optional().default(null),
  servings: requiredNumber('Servings', 0.01, 100),
  calories: requiredNumber('Calories', 0, 10000),
  proteinG: optionalNumber('Protein', 0, 1000),
  carbsG: optionalNumber('Carbs', 0, 1000),
  fatG: optionalNumber('Fat', 0, 1000),
}).transform((e) => ({
  ...e,
  servings: round(e.servings, 2),
  calories: round(e.calories, 1),
  proteinG: round(e.proteinG ?? 0, 1),
  carbsG: round(e.carbsG ?? 0, 1),
  fatG: round(e.fatG ?? 0, 1),
}));

export type EntryInput = z.infer<typeof entrySchema>;
