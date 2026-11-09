'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canonicalBarcode } from '@/lib/barcode';
import { addDays, isIsoDate } from '@/lib/dates';
import { setFlash } from '@/lib/flash';
import { addEntry, deleteEntry, getEntries, getEntry, updateEntry } from '@/lib/food';
import { findProduct, upsertProduct } from '@/lib/products';
import { MEALS, type Meal } from '@/lib/types';
import { entrySchema, failure, type FormState } from '@/lib/validation';

async function userOrRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Add or edit a diary entry from the diary modal. */
export async function saveEntry(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = await userOrRedirect();
  const parsed = entrySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return failure(parsed.error, fd);
  const { id, date, barcode, ...e } = parsed.data;

  if (id) {
    const existing = await getEntry(user.id, id);
    if (!existing) return { error: 'That entry no longer exists.' };
    await updateEntry(user.id, id, { ...e, entryDate: date });
    await setFlash('success', `Updated ${e.name}.`);
  } else {
    await addEntry(user.id, { ...e, entryDate: date, barcode: barcode ?? null });
    await setFlash('success', `Added ${e.name} to ${e.meal.toLowerCase()}.`);
  }
  revalidatePath('/diary');
  return { ok: true, nonce: Date.now() };
}

export async function removeEntry(fd: FormData) {
  const user = await userOrRedirect();
  const id = Number(fd.get('id'));
  if (Number.isInteger(id) && id > 0) {
    await deleteEntry(user.id, id);
    await setFlash('success', 'Entry removed.');
  }
  revalidatePath('/diary');
}

/** Copies all of yesterday's entries for one meal into the selected day. */
export async function copyFromYesterday(fd: FormData) {
  const user = await userOrRedirect();
  const date = String(fd.get('date'));
  const meal = String(fd.get('meal')) as Meal;
  if (!isIsoDate(date) || !MEALS.includes(meal)) return;

  const previous = (await getEntries(user.id, addDays(date, -1))).filter((e) => e.meal === meal);
  for (const { id: _id, ...e } of previous) await addEntry(user.id, { ...e, entryDate: date });
  await setFlash(
    previous.length ? 'success' : 'danger',
    previous.length
      ? `Copied ${previous.length} item(s) from yesterday's ${meal.toLowerCase()}.`
      : `Nothing logged for ${meal.toLowerCase()} yesterday.`,
  );
  revalidatePath('/diary');
}

/** Adds a scanned product to the diary, optionally remembering an unknown barcode for next time. */
export async function addScannedEntry(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = await userOrRedirect();
  const parsed = entrySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return failure(parsed.error, fd);
  const { date, barcode: scanned, id: _id, ...e } = parsed.data;
  const barcode = scanned ? canonicalBarcode(scanned) : undefined;

  if (fd.get('saveProduct') === 'on' && barcode && !(await findProduct(barcode, user.id))) {
    await upsertProduct({
      barcode,
      ownerId: user.id,
      name: e.name,
      brand: e.brand,
      servingDescription: e.servingDescription,
      servingGrams: null,
      caloriesPer100g: null,
      proteinPer100g: null,
      carbsPer100g: null,
      fatPer100g: null,
      caloriesPerServing: e.calories,
      proteinPerServing: e.proteinG,
      carbsPerServing: e.carbsG,
      fatPerServing: e.fatG,
      imageUrl: null,
      source: 'user',
    });
  }

  await addEntry(user.id, { ...e, entryDate: date, barcode: barcode ?? null });
  const total = Math.round(e.calories * e.servings).toLocaleString('en-US');
  await setFlash('success', `Added ${e.name} (${total} kcal) to ${e.meal.toLowerCase()}.`);
  revalidatePath('/diary');
  redirect(`/diary?date=${date}`);
}
