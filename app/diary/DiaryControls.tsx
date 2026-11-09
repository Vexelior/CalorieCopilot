'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { copyFromYesterday } from '@/app/actions/diary';
import type { FoodEntry, Meal, RecentFood } from '@/lib/types';
import { useDiary } from './DiaryProvider';

export function AddFoodButton({ meal, className, label, children }: { meal?: Meal; className?: string; label?: string; children: React.ReactNode }) {
  const { open, defaultMeal } = useDiary();
  return (
    <button type="button" className={className} aria-label={label} data-add-meal={meal ?? defaultMeal}
      onClick={() => open({ meal: meal ?? defaultMeal, servings: 1 })}>
      {children}
    </button>
  );
}

export function EditEntryButton({ entry }: { entry: FoodEntry }) {
  const { open } = useDiary();
  return (
    <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={`Edit ${entry.name}`} data-edit=""
      onClick={() => open({ ...entry })}>
      <i className="bi bi-pencil" />
    </button>
  );
}

export function RecentFoodButton({ food, children }: { food: RecentFood; children: React.ReactNode }) {
  const { open, defaultMeal } = useDiary();
  return (
    <button type="button" className="list-group-item list-group-item-action d-flex justify-content-between align-items-center" data-recent=""
      onClick={() => open({ ...food, meal: defaultMeal, servings: 1 })}>
      {children}
    </button>
  );
}

/** "…" menu on each meal card. */
export function MealMenu({ meal, date }: { meal: Meal; date: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { open } = useDiary();

  useEffect(() => {
    if (!show) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setShow(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [show]);

  return (
    <div className="dropdown position-relative" ref={ref}>
      <button className="btn btn-sm btn-light border" type="button" aria-expanded={show} aria-haspopup="menu"
        aria-label={`${meal} options`} data-bs-toggle="dropdown" onClick={() => setShow((s) => !s)}>
        <i className="bi bi-three-dots" />
      </button>
      {show && (
        <ul className="dropdown-menu dropdown-menu-end show" role="menu">
          <li>
            <button className="dropdown-item" type="button" role="menuitem" onClick={() => { setShow(false); open({ meal, servings: 1 }); }}>
              <i className="bi bi-plus-lg" /> Add food
            </button>
          </li>
          <li>
            <Link className="dropdown-item" role="menuitem" href={`/scan?date=${date}&meal=${meal}`}><i className="bi bi-upc-scan" /> Scan barcode</Link>
          </li>
          <li>
            <form action={copyFromYesterday} onSubmit={() => setShow(false)} data-action="copy-previous">
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="meal" value={meal} />
              <button className="dropdown-item" type="submit" role="menuitem"><i className="bi bi-copy" /> Copy from yesterday</button>
            </form>
          </li>
        </ul>
      )}
    </div>
  );
}

export function DatePicker({ date }: { date: string }) {
  const router = useRouter();
  return (
    <input type="date" name="date" className="form-control" style={{ width: 'auto' }} defaultValue={date} key={date}
      aria-label="Choose date" onChange={(e) => { if (e.target.value) router.push(`/diary?date=${e.target.value}`); }} />
  );
}
