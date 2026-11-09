'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { destroySession, getCurrentUser, rotateSessions } from '@/lib/auth';
import { addDays, isValidTimeZone, todayIn } from '@/lib/dates';
import { setFlash } from '@/lib/flash';
import { suggestGoals } from '@/lib/goals';
import { hashPassword, passwordProblems, verifyPassword } from '@/lib/password';
import { ACTIVITY_LEVELS, CM_PER_INCH, KG_PER_LB, SEXES, WEIGHT_GOALS } from '@/lib/types';
import { deleteUserAndData, emailInUse, getPasswordHash, updateUser } from '@/lib/users';
import { failure, formValues, isoDate, optionalNumber, requiredNumber, type FormState } from '@/lib/validation';
import { upsertWeight } from '@/lib/weights';

async function userOrRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

async function done(message: string): Promise<FormState> {
  await setFlash('success', message);
  revalidatePath('/', 'layout');
  return { ok: true, nonce: Date.now() };
}

const accountSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required.').max(50, 'Display name must be at most 50 characters.'),
  email: z.email('Enter a valid email address.').max(254),
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone.'),
  useMetric: z.enum(['true', 'false']).transform((v) => v === 'true'),
});

export async function updateAccount(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = await userOrRedirect();
  const parsed = accountSchema.safeParse(formValues(fd));
  if (!parsed.success) return failure(parsed.error, fd);
  const v = parsed.data;

  if (v.email.toLowerCase() !== user.email.toLowerCase() && (await emailInUse(v.email, user.id))) {
    return { fieldErrors: { email: ['That email is already in use.'] }, values: formValues(fd) };
  }
  if (!(await updateUser(user.id, v))) {
    return { fieldErrors: { email: ['That email is already in use.'] }, values: formValues(fd) };
  }
  return done('Account settings saved.');
}

const bodySchema = z.object({
  sex: z.union([z.enum(SEXES), z.literal('')]).transform((v) => v || null),
  birthDate: z.union([isoDate, z.literal('')]).transform((v) => v || null),
  heightCm: optionalNumber('Height', 50, 260),
  heightFt: optionalNumber('Height (ft)', 2, 8),
  heightIn: optionalNumber('Height (in)', 0, 11.9),
  weight: optionalNumber('Weight', 20, 1000),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  weightGoal: z.enum(WEIGHT_GOALS),
});

export async function updateBody(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = await userOrRedirect();
  const parsed = bodySchema.safeParse(formValues(fd));
  if (!parsed.success) return failure(parsed.error, fd);
  const v = parsed.data;
  const today = todayIn(user.timeZone);

  if (v.birthDate && (v.birthDate > today || v.birthDate < addDays(today, -120 * 366))) {
    return { fieldErrors: { birthDate: ['Please enter a valid date of birth.'] }, values: formValues(fd) };
  }

  const heightCm = user.useMetric
    ? (v.heightCm ?? null)
    : v.heightFt != null ? Math.round((v.heightFt * 12 + (v.heightIn ?? 0)) * CM_PER_INCH * 10) / 10 : null;
  const weightKg = v.weight != null ? Math.round((user.useMetric ? v.weight : v.weight * KG_PER_LB) * 100) / 100 : null;

  if (weightKg != null && (user.weightKg == null || Math.abs(user.weightKg - weightKg) > 0.001)) {
    await upsertWeight(user.id, today, weightKg);
  }
  await updateUser(user.id, { sex: v.sex, birthDate: v.birthDate, heightCm, weightKg, activityLevel: v.activityLevel, weightGoal: v.weightGoal });
  return done('Body details saved.');
}

const targetsSchema = z.object({
  dailyCalorieGoal: requiredNumber('Daily calories', 800, 10000),
  proteinGoalG: requiredNumber('Protein', 0, 1000),
  carbsGoalG: requiredNumber('Carbs', 0, 2000),
  fatGoalG: requiredNumber('Fat', 0, 1000),
});

export async function updateTargets(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = await userOrRedirect();
  const parsed = targetsSchema.safeParse(formValues(fd));
  if (!parsed.success) return failure(parsed.error, fd);
  const v = parsed.data;
  await updateUser(user.id, {
    dailyCalorieGoal: Math.round(v.dailyCalorieGoal),
    proteinGoalG: Math.round(v.proteinGoalG),
    carbsGoalG: Math.round(v.carbsGoalG),
    fatGoalG: Math.round(v.fatGoalG),
  });
  return done('Daily targets saved.');
}

export async function applySuggestion() {
  const user = await userOrRedirect();
  const s = suggestGoals(user, todayIn(user.timeZone));
  if (!s) {
    await setFlash('danger', 'Fill in your sex, date of birth, height and weight to get suggested targets.');
  } else {
    await updateUser(user.id, { dailyCalorieGoal: s.calories, proteinGoalG: s.proteinG, carbsGoalG: s.carbsG, fatGoalG: s.fatG });
    await setFlash('success', `Targets updated to ${s.calories.toLocaleString('en-US')} kcal per day.`);
  }
  revalidatePath('/', 'layout');
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().max(100),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    const problems = passwordProblems(v.newPassword);
    if (problems.length) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: `Password needs ${problems.join(', ')}.` });
    if (v.newPassword !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'The passwords do not match.' });
  });

export async function changePassword(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = await userOrRedirect();
  const parsed = passwordSchema.safeParse(formValues(fd));
  if (!parsed.success) return { fieldErrors: failure(parsed.error, fd).fieldErrors };

  const hash = await getPasswordHash(user.id);
  if (!hash || !(await verifyPassword(parsed.data.currentPassword, hash))) {
    return { fieldErrors: { currentPassword: ['Your current password is incorrect.'] } };
  }
  await updateUser(user.id, { passwordHash: await hashPassword(parsed.data.newPassword) });
  await rotateSessions(user.id); // signs out other devices
  return done('Your password has been changed.');
}

export async function deleteAccount(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const user = await userOrRedirect();
  const password = String(fd.get('password') ?? '');
  const hash = await getPasswordHash(user.id);
  if (!password || !hash || !(await verifyPassword(password, hash))) {
    return { error: 'Incorrect password. Your account was not deleted.' };
  }
  await deleteUserAndData(user.id);
  await destroySession();
  await setFlash('success', 'Your account and all of its data have been deleted.');
  redirect('/');
}
