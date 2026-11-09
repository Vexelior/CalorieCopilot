import { n0 } from '@/lib/format';

const R = 72;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Ring showing calories eaten against the goal. */
export function CalorieRing({ consumed, goal, variant = 'remaining' }: { consumed: number; goal: number; variant?: 'remaining' | 'eaten' }) {
  const safeGoal = Math.max(1, goal);
  const remaining = safeGoal - consumed;
  const offset = CIRCUMFERENCE * (1 - Math.min(1, consumed / safeGoal));
  return (
    <div className={`ring ${remaining < 0 ? 'over' : ''}`} role="img" aria-label={`${n0(consumed)} of ${n0(safeGoal)} kilocalories consumed`}>
      <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
        <circle className="track" cx="84" cy="84" r={R} fill="none" strokeWidth="14" />
        <circle className="value" cx="84" cy="84" r={R} fill="none" strokeWidth="14" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} />
      </svg>
      <div className="label">
        {variant === 'eaten' ? (
          <>
            <div className="big">{n0(consumed)}</div>
            <div className="small text-body-secondary">of {n0(safeGoal)} kcal</div>
          </>
        ) : (
          <>
            <div className="big">{n0(Math.abs(remaining))}</div>
            <div className="small text-body-secondary">{remaining < 0 ? 'kcal over' : 'kcal left'}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function MacroBar({ label, cls, value, target }: { label: string; cls: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <>
      <div className="small mb-1 d-flex justify-content-between">
        <span><span className={`swatch ${cls}`} />{label}</span>
        <span className="text-body-secondary">{n0(value)} / {target} g</span>
      </div>
      <div className="macro-bar mb-3" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={target}>
        <span className={cls} style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}
