import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { guessMeal, hourIn, isIsoDate, todayIn } from '@/lib/dates';
import { MEALS, type Meal } from '@/lib/types';
import { ScanTabs } from '@/components/ScanTabs';
import { Scanner } from './Scanner';

export const metadata: Metadata = { title: 'Scan barcode' };

export default async function ScanPage({ searchParams }: PageProps<'/scan'>) {
  const user = await requireUser('/scan');
  const { date: rawDate, meal: rawMeal } = await searchParams;
  const date = isIsoDate(rawDate) ? rawDate : todayIn(user.timeZone);
  const meal: Meal = MEALS.includes(rawMeal as Meal) ? (rawMeal as Meal) : guessMeal(hourIn(user.timeZone));

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="h3 mb-0">Scan a barcode</h1>
          <div className="text-body-secondary">Point your camera at the barcode on the package.</div>
        </div>
        <Link href={`/diary?date=${date}`} className="btn btn-outline-secondary d-none d-sm-inline-block"><i className="bi bi-arrow-left" /> Diary</Link>
      </div>
      <ScanTabs active="barcode" date={date} meal={meal} />
      <Scanner date={date} meal={meal} />
    </>
  );
}
