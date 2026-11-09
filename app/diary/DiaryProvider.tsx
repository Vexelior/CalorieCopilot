'use client';

import { createContext, useActionState, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { saveEntry } from '@/app/actions/diary';
import { FieldError, SubmitButton, fieldClass } from '@/components/forms';
import { n0 } from '@/lib/format';
import { MEALS, type Meal } from '@/lib/types';
import type { FormState } from '@/lib/validation';

export interface Draft {
  id?: number;
  meal: Meal;
  name?: string;
  brand?: string | null;
  servingDescription?: string | null;
  servings?: number;
  calories?: number | string;
  proteinG?: number | string;
  carbsG?: number | string;
  fatG?: number | string;
}

interface DiaryContextValue {
  open: (draft: Draft) => void;
  defaultMeal: Meal;
}

const DiaryContext = createContext<DiaryContextValue | null>(null);

export function useDiary() {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error('useDiary must be used inside <DiaryProvider>');
  return ctx;
}

/** Holds the add/edit entry modal for the diary page. */
export function DiaryProvider({ date, defaultMeal, children }: { date: string; defaultMeal: Meal; children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [session, setSession] = useState(0);
  const submittedSession = useRef(-1);
  const [state, action] = useActionState(saveEntry, undefined);

  const open = useCallback((d: Draft) => {
    setSession((s) => s + 1);
    setDraft(d);
  }, []);
  const close = useCallback(() => setDraft(null), []);

  // Close after a successful save (the page re-renders with fresh data).
  useEffect(() => {
    if (state?.ok) setDraft(null);
  }, [state?.nonce, state?.ok]);

  // Escape closes; lock background scroll while open.
  useEffect(() => {
    if (!draft) return;
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); document.removeEventListener('keydown', onKey); };
  }, [draft, close]);

  // Only show errors from a submit made in the currently open modal.
  const current = state && !state.ok && submittedSession.current === session ? state : undefined;
  const value = useMemo(() => ({ open, defaultMeal }), [open, defaultMeal]);

  return (
    <DiaryContext.Provider value={value}>
      {children}
      {draft && (
        <EntryModal key={session} draft={draft} date={date} state={current} action={action} onClose={close}
          onSubmit={() => { submittedSession.current = session; }} />
      )}
    </DiaryContext.Provider>
  );
}

function EntryModal({ draft, date, state, action, onClose, onSubmit }: {
  draft: Draft;
  date: string;
  state: FormState | undefined;
  action: (fd: FormData) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const v = state?.values;
  const val = (name: keyof Draft) => v?.[name] ?? (draft[name] == null ? '' : String(draft[name]));
  const [servings, setServings] = useState(Number(val('servings') || 1));
  const [calories, setCalories] = useState(Number(val('calories') || 0));
  const isEdit = draft.id != null;
  const errorCount = Object.values(state?.fieldErrors ?? {}).filter((e) => e?.length).length;

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="entryModalTitle" tabIndex={-1}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
        <form className="modal-content" action={action} onSubmit={onSubmit} id="entryForm">
          <div className="modal-header">
            <h2 className="modal-title h5" id="entryModalTitle">{isEdit ? 'Edit food' : 'Add food'}</h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {(state?.error || errorCount > 0) && (
              <div className="alert alert-danger py-2 small validation-summary-errors" role="alert">
                {state?.error ?? 'Please fix the highlighted fields.'}
              </div>
            )}
            <input type="hidden" name="id" value={draft.id ?? ''} />
            <input type="hidden" name="date" value={date} />
            <div className="row g-3">
              <div className="col-12">
                <label htmlFor="Input_Name" className="form-label">Food</label>
                <input id="Input_Name" name="name" className={fieldClass(state, 'name')} placeholder="e.g. Greek yogurt" required maxLength={120} defaultValue={val('name')} autoFocus />
                <FieldError state={state} name="name" />
              </div>
              <div className="col-sm-7">
                <label htmlFor="Input_Brand" className="form-label">Brand <span className="text-body-secondary">(optional)</span></label>
                <input id="Input_Brand" name="brand" className={fieldClass(state, 'brand')} maxLength={80} defaultValue={val('brand')} />
              </div>
              <div className="col-sm-5">
                <label htmlFor="Input_Meal" className="form-label">Meal</label>
                <select id="Input_Meal" name="meal" className="form-select" defaultValue={val('meal')}>
                  {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-7">
                <label htmlFor="Input_ServingDescription" className="form-label">Serving size</label>
                <input id="Input_ServingDescription" name="servingDescription" className={fieldClass(state, 'servingDescription')} placeholder="e.g. 1 cup, 100 g" maxLength={60} defaultValue={val('servingDescription')} />
              </div>
              <div className="col-5">
                <label htmlFor="Input_Servings" className="form-label">Servings</label>
                <input id="Input_Servings" name="servings" className={fieldClass(state, 'servings')} type="number" step="any" min="0.01" max="100" required
                  defaultValue={val('servings') || '1'} onChange={(e) => setServings(Number(e.target.value) || 0)} />
                <FieldError state={state} name="servings" />
              </div>
              <div className="col-12"><div className="small text-body-secondary">Nutrition per serving</div></div>
              <NumberField state={state} id="Input_Calories" name="calories" label="kcal" max={10000} required defaultValue={val('calories')}
                onChange={(n) => setCalories(n)} />
              <NumberField state={state} id="Input_ProteinG" name="proteinG" label="Protein g" swatch="bg-protein" max={1000} defaultValue={val('proteinG')} />
              <NumberField state={state} id="Input_CarbsG" name="carbsG" label="Carbs g" swatch="bg-carbs" max={1000} defaultValue={val('carbsG')} />
              <NumberField state={state} id="Input_FatG" name="fatG" label="Fat g" swatch="bg-fat" max={1000} defaultValue={val('fatG')} />
              <div className="col-12">
                <div className="alert alert-light border mb-0 py-2 small d-flex justify-content-between">
                  <span>Total for this entry</span><strong id="entryTotal">{n0(calories * servings)} kcal</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <SubmitButton id="entrySubmit"><i className="bi bi-check-lg" /> Save</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function NumberField({ state, id, name, label, swatch, max, required, defaultValue, onChange }: {
  state: FormState | undefined;
  id: string; name: string; label: string; swatch?: string; max: number; required?: boolean; defaultValue: string;
  onChange?: (n: number) => void;
}) {
  return (
    <div className="col-6 col-sm-3">
      <label htmlFor={id} className="form-label small">{swatch && <span className={`swatch ${swatch}`} />}{label}</label>
      <input id={id} name={name} className={fieldClass(state, name)} type="number" step="any" min="0" max={max} required={required}
        defaultValue={defaultValue} onChange={onChange ? (e) => onChange(Number(e.target.value) || 0) : undefined} />
      <FieldError state={state} name={name} />
    </div>
  );
}
