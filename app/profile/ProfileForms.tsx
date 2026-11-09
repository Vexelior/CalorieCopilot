'use client';

import { useActionState, useState } from 'react';
import { changePassword, deleteAccount, updateAccount, updateBody, updateTargets } from '@/app/actions/profile';
import { FieldError, FormAlert, SubmitButton, fieldClass } from '@/components/forms';
import { ACTIVITY_LABELS, ACTIVITY_LEVELS, CM_PER_INCH, GOAL_LABELS, KG_PER_LB, WEIGHT_GOALS, type User } from '@/lib/types';

const str = (v: number | string | null | undefined) => (v == null ? '' : String(v));

export function TargetsForm({ user }: { user: User }) {
  const [state, action] = useActionState(updateTargets, undefined);
  const v = state?.values;
  const initial = {
    dailyCalorieGoal: v?.dailyCalorieGoal ?? str(user.dailyCalorieGoal),
    proteinGoalG: v?.proteinGoalG ?? str(user.proteinGoalG),
    carbsGoalG: v?.carbsGoalG ?? str(user.carbsGoalG),
    fatGoalG: v?.fatGoalG ?? str(user.fatGoalG),
  };
  const [live, setLive] = useState(initial);
  const kcal = (Number(live.proteinGoalG) || 0) * 4 + (Number(live.carbsGoalG) || 0) * 4 + (Number(live.fatGoalG) || 0) * 9;
  const diff = Math.round(kcal - (Number(live.dailyCalorieGoal) || 0));
  const track = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) => setLive((l) => ({ ...l, [key]: e.target.value }));

  return (
    <form action={action} className="row g-3" key={`${user.dailyCalorieGoal}-${user.proteinGoalG}-${user.carbsGoalG}-${user.fatGoalG}`} data-form="targets">
      <div className="col-12">
        <label htmlFor="Targets_DailyCalorieGoal" className="form-label">Daily calories</label>
        <div className="input-group has-validation">
          <input id="Targets_DailyCalorieGoal" name="dailyCalorieGoal" type="number" min="800" max="10000" step="10" required
            className={fieldClass(state, 'dailyCalorieGoal')} defaultValue={initial.dailyCalorieGoal} onChange={track('dailyCalorieGoal')} />
          <span className="input-group-text">kcal</span>
        </div>
        <FieldError state={state} name="dailyCalorieGoal" />
      </div>
      {([['proteinGoalG', 'Protein g', 'bg-protein', 1000], ['carbsGoalG', 'Carbs g', 'bg-carbs', 2000], ['fatGoalG', 'Fat g', 'bg-fat', 1000]] as const).map(([name, label, swatch, max]) => (
        <div className="col-4" key={name}>
          <label htmlFor={`Targets_${name[0].toUpperCase()}${name.slice(1)}`} className="form-label small"><span className={`swatch ${swatch}`} />{label}</label>
          <input id={`Targets_${name[0].toUpperCase()}${name.slice(1)}`} name={name} type="number" min="0" max={max} required
            className={fieldClass(state, name)} defaultValue={initial[name]} onChange={track(name)} />
          <FieldError state={state} name={name} />
        </div>
      ))}
      <div className="col-12 d-flex justify-content-between align-items-center">
        <span className="small text-body-secondary" id="macro-kcal">
          Macros add up to {Math.round(kcal).toLocaleString('en-US')} kcal
          {Number(live.dailyCalorieGoal) > 0 && Math.abs(diff) > 50 && ` (${diff > 0 ? '+' : ''}${diff.toLocaleString('en-US')} vs. target)`}
        </span>
        <SubmitButton><i className="bi bi-check-lg" /> Save targets</SubmitButton>
      </div>
    </form>
  );
}

export function BodyForm({ user }: { user: User }) {
  const [state, action] = useActionState(updateBody, undefined);
  const v = state?.values;
  const inches = user.heightCm != null ? user.heightCm / CM_PER_INCH : null;
  const weight = user.weightKg != null ? Math.round((user.useMetric ? user.weightKg : user.weightKg / KG_PER_LB) * 10) / 10 : null;
  const val = (name: string, fallback: string) => v?.[name] ?? fallback;

  return (
    <form action={action} className="row g-3" data-form="body" key={`${user.useMetric}-${user.heightCm}-${user.weightKg}`}>
      <div className="col-sm-6">
        <label htmlFor="Body_Sex" className="form-label">Sex</label>
        <select id="Body_Sex" name="sex" className="form-select" defaultValue={val('sex', user.sex ?? '')}>
          <option value="">Prefer not to say</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
        <div className="form-text">Used only to estimate your energy needs.</div>
      </div>
      <div className="col-sm-6">
        <label htmlFor="Body_BirthDate" className="form-label">Date of birth</label>
        <input id="Body_BirthDate" name="birthDate" type="date" className={fieldClass(state, 'birthDate')} defaultValue={val('birthDate', user.birthDate ?? '')} />
        <FieldError state={state} name="birthDate" />
      </div>
      {user.useMetric ? (
        <div className="col-sm-6">
          <label htmlFor="Body_HeightCm" className="form-label">Height</label>
          <div className="input-group">
            <input id="Body_HeightCm" name="heightCm" type="number" step="0.1" min="50" max="260" className={fieldClass(state, 'heightCm')} defaultValue={val('heightCm', str(user.heightCm))} />
            <span className="input-group-text">cm</span>
          </div>
          <FieldError state={state} name="heightCm" />
        </div>
      ) : (
        <div className="col-sm-6">
          <label className="form-label" htmlFor="Body_HeightFt">Height</label>
          <div className="input-group">
            <input id="Body_HeightFt" name="heightFt" type="number" min="2" max="8" className={fieldClass(state, 'heightFt')} aria-label="Feet"
              defaultValue={val('heightFt', inches != null ? String(Math.floor(inches / 12)) : '')} />
            <span className="input-group-text">ft</span>
            <input id="Body_HeightIn" name="heightIn" type="number" step="0.1" min="0" max="11.9" className={fieldClass(state, 'heightIn')} aria-label="Inches"
              defaultValue={val('heightIn', inches != null ? String(Math.round((inches % 12) * 10) / 10) : '')} />
            <span className="input-group-text">in</span>
          </div>
          <FieldError state={state} name="heightFt" />
          <FieldError state={state} name="heightIn" />
        </div>
      )}
      <div className="col-sm-6">
        <label htmlFor="Body_Weight" className="form-label">Current weight</label>
        <div className="input-group">
          <input id="Body_Weight" name="weight" type="number" step="0.1" min="20" max="1000" className={fieldClass(state, 'weight')} defaultValue={val('weight', str(weight))} />
          <span className="input-group-text">{user.useMetric ? 'kg' : 'lb'}</span>
        </div>
        <FieldError state={state} name="weight" />
      </div>
      <div className="col-sm-6">
        <label htmlFor="Body_ActivityLevel" className="form-label">Activity level</label>
        <select id="Body_ActivityLevel" name="activityLevel" className="form-select" defaultValue={val('activityLevel', user.activityLevel)}>
          {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
        </select>
      </div>
      <div className="col-sm-6">
        <label htmlFor="Body_WeightGoal" className="form-label">Goal</label>
        <select id="Body_WeightGoal" name="weightGoal" className="form-select" defaultValue={val('weightGoal', user.weightGoal)}>
          {WEIGHT_GOALS.map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
        </select>
      </div>
      <div className="col-12 text-end">
        <SubmitButton><i className="bi bi-check-lg" /> Save body details</SubmitButton>
      </div>
    </form>
  );
}

export function AccountForm({ user, timeZones }: { user: User; timeZones: string[] }) {
  const [state, action] = useActionState(updateAccount, undefined);
  const v = state?.values;
  const metric = (v?.useMetric ?? String(user.useMetric)) === 'true';

  return (
    <form action={action} className="row g-3" data-form="account" key={`${user.email}-${user.useMetric}-${user.timeZone}`}>
      <div className="col-12">
        <label htmlFor="Account_DisplayName" className="form-label">Display name</label>
        <input id="Account_DisplayName" name="displayName" className={fieldClass(state, 'displayName')} autoComplete="name" maxLength={50}
          defaultValue={v?.displayName ?? user.displayName ?? ''} required />
        <FieldError state={state} name="displayName" />
      </div>
      <div className="col-12">
        <label htmlFor="Account_Email" className="form-label">Email</label>
        <input id="Account_Email" name="email" type="email" className={fieldClass(state, 'email')} autoComplete="email" defaultValue={v?.email ?? user.email} required />
        <FieldError state={state} name="email" />
      </div>
      <div className="col-12">
        <label htmlFor="Account_TimeZone" className="form-label">Time zone</label>
        <select id="Account_TimeZone" name="timeZone" className={fieldClass(state, 'timeZone', 'form-select')} defaultValue={v?.timeZone ?? user.timeZone}>
          {timeZones.map((tz) => <option key={tz} value={tz}>{tz.replaceAll('_', ' ')}</option>)}
        </select>
        <div className="form-text">Decides when your &quot;today&quot; starts.</div>
        <FieldError state={state} name="timeZone" />
      </div>
      <div className="col-12">
        <div className="form-label">Units</div>
        <div className="btn-group w-100" role="group" aria-label="Units">
          <input type="radio" className="btn-check" name="useMetric" id="units-metric" value="true" defaultChecked={metric} />
          <label className="btn btn-outline-success" htmlFor="units-metric">Metric (kg, cm)</label>
          <input type="radio" className="btn-check" name="useMetric" id="units-imperial" value="false" defaultChecked={!metric} />
          <label className="btn btn-outline-success" htmlFor="units-imperial">Imperial (lb, ft)</label>
        </div>
      </div>
      <div className="col-12 text-end">
        <SubmitButton><i className="bi bi-check-lg" /> Save account</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  const fields = [
    ['currentPassword', 'Password_CurrentPassword', 'Current password', 'current-password'],
    ['newPassword', 'Password_NewPassword', 'New password', 'new-password'],
    ['confirmPassword', 'Password_ConfirmPassword', 'Confirm new password', 'new-password'],
  ] as const;
  return (
    <form action={action} className="row g-3" data-form="password">
      {fields.map(([name, id, label, autoComplete]) => (
        <div className="col-12" key={name}>
          <label htmlFor={id} className="form-label">{label}</label>
          <input id={id} name={name} type="password" className={fieldClass(state, name)} autoComplete={autoComplete} required />
          <FieldError state={state} name={name} />
        </div>
      ))}
      <div className="col-12 text-end">
        <SubmitButton className="btn btn-outline-success"><i className="bi bi-key" /> Update password</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, undefined);
  return (
    <form action={action} data-form="delete" onSubmit={(e) => { if (!confirm('Delete your account and all of your data permanently?')) e.preventDefault(); }}>
      <FormAlert state={state} />
      <div className="d-flex gap-2">
        <input type="password" name="password" className="form-control" placeholder="Confirm with your password" autoComplete="current-password" required aria-label="Password" />
        <SubmitButton className="btn btn-danger text-nowrap"><i className="bi bi-trash" /> Delete</SubmitButton>
      </div>
    </form>
  );
}
