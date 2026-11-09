'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { todayIn } from '@/lib/dates';
import { setFlash } from '@/lib/flash';
import { KG_PER_LB } from '@/lib/types';
import { updateUser } from '@/lib/users';
import { upsertWeight } from '@/lib/weights';

export async function logWeight(fd: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const value = Number(fd.get('weight'));
  if (!Number.isFinite(value) || value < 20 || value > 1000) {
    await setFlash('danger', 'Please enter a valid weight.');
  } else {
    const kg = Math.round((user.useMetric ? value : value * KG_PER_LB) * 100) / 100;
    await upsertWeight(user.id, todayIn(user.timeZone), kg);
    await updateUser(user.id, { weightKg: kg });
    await setFlash('success', `Logged today's weight: ${Math.round(value * 10) / 10} ${user.useMetric ? 'kg' : 'lb'}.`);
  }
  revalidatePath('/analytics');
}
