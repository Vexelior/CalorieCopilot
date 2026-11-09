import type { Metadata } from 'next';
import Link from 'next/link';
import { ScanTabs } from '@/components/ScanTabs';
import { requireUser } from '@/lib/auth';
import { guessMeal, hourIn, isIsoDate, todayIn } from '@/lib/dates';
import { DAILY_LIMIT, photoEstimatesConfigured, remainingEstimates } from '@/lib/food-photo';
import { MEALS, type Meal } from '@/lib/types';
import { PhotoEstimator } from './PhotoEstimator';

export const metadata: Metadata = { title: 'Estimate from a photo' };

export default async function PhotoEstimatePage({ searchParams }: PageProps<'/scan/photo'>) {
  const user = await requireUser('/scan/photo');
  const { date: rawDate, meal: rawMeal } = await searchParams;
  const date = isIsoDate(rawDate) ? rawDate : todayIn(user.timeZone);
  const meal: Meal = MEALS.includes(rawMeal as Meal) ? (rawMeal as Meal) : guessMeal(hourIn(user.timeZone));
  const configured = photoEstimatesConfigured();
  const remaining = configured ? await remainingEstimates(user.id) : 0;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="h3 mb-0">Estimate from a photo</h1>
          <div className="text-body-secondary">Snap your meal and get a calorie estimate you can adjust.</div>
        </div>
        <Link href={`/diary?date=${date}`} className="btn btn-outline-secondary d-none d-sm-inline-block"><i className="bi bi-arrow-left" /> Diary</Link>
      </div>
      <ScanTabs active="photo" date={date} meal={meal} />
      {configured ? (
        <PhotoEstimator date={date} meal={meal} remaining={remaining} dailyLimit={DAILY_LIMIT} />
      ) : (
        <div className="alert alert-warning d-flex gap-2" role="alert">
          <i className="bi bi-exclamation-triangle" aria-hidden="true" />
          <div>Photo estimates aren&apos;t set up yet. The site owner needs to add an <code>ANTHROPIC_API_KEY</code> environment variable.</div>
        </div>
      )}
    </>
  );
}
