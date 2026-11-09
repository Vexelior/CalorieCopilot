'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addEstimatedItems } from '@/app/actions/diary';
import { FormAlert, SubmitButton } from '@/components/forms';
import { n0 } from '@/lib/format';
import { MEALS, type Meal } from '@/lib/types';

/** Longest edge sent to the model: larger images are downscaled by the API anyway and cost more to upload. */
const MAX_EDGE = 1568;

interface EstimatedItem {
  name: string; portion: string; grams: number; calories: number;
  protein_g: number; carbs_g: number; fat_g: number; confidence: 'low' | 'medium' | 'high';
}
interface Estimate { is_food: boolean; items: EstimatedItem[]; notes: string; remaining?: number }
interface Row { include: boolean; name: string; portion: string; calories: string; proteinG: string; carbsG: string; fatG: string; confidence: EstimatedItem['confidence'] }

type Phase = 'pick' | 'analysing' | 'review';

const CONFIDENCE_BADGE = { high: 'text-bg-success', medium: 'text-bg-warning', low: 'text-bg-secondary' } as const;

/** Decodes any photo the browser can display (including iPhone HEIC in Safari) and re-encodes it as a JPEG. */
async function prepareImage(file: File): Promise<{ blob: Blob; previewUrl: string }> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    source = img;
  }
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85));
  return { blob, previewUrl: URL.createObjectURL(blob) };
}

export function PhotoEstimator({ date, meal, remaining: initialRemaining, dailyLimit }: { date: string; meal: Meal; remaining: number; dailyLimit: number }) {
  const [state, action] = useActionState(addEstimatedItems, undefined);
  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<Meal>(meal);
  const [remaining, setRemaining] = useState(initialRemaining);
  const reviewRef = useRef<HTMLFormElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const prepared = await prepareImage(file);
      setPreview(prepared.previewUrl);
      setBlob(prepared.blob);
      setPhase('pick');
      setRows([]);
    } catch {
      setError("That file couldn't be opened as a photo. Try a JPEG or PNG.");
    }
  };

  const analyse = async () => {
    if (!blob) return;
    setError('');
    setPhase('analysing');
    try {
      const body = new FormData();
      body.append('image', blob, 'meal.jpg');
      body.append('note', note);
      const res = await fetch('/api/estimate', { method: 'POST', body });
      if (res.status === 401) { window.location.href = '/login?returnUrl=/scan/photo'; return; }
      const data = (await res.json().catch(() => ({}))) as Estimate & { error?: string };
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (!res.ok) throw new Error(data.error || 'Something went wrong while estimating. Please try again.');
      if (!data.is_food || data.items.length === 0) {
        setPhase('pick');
        setError(data.notes || "We couldn't spot any food in that photo. Try a closer shot of the plate.");
        return;
      }
      setRows(data.items.map((i) => ({
        include: true, name: i.name, portion: i.portion, confidence: i.confidence,
        calories: String(i.calories), proteinG: String(i.protein_g), carbsG: String(i.carbs_g), fatG: String(i.fat_g),
      })));
      setNotes(data.notes);
      setPhase('review');
      requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setPhase('pick');
      setError(err instanceof Error ? err.message : 'Something went wrong while estimating. Please try again.');
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const included = rows.filter((r) => r.include);
  const total = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') => included.reduce((s, r) => s + (parseFloat(r[k]) || 0), 0);
  const payload = JSON.stringify(included.map(({ name, portion, calories, proteinG, carbsG, fatG }) => ({ name, portion, calories, proteinG, carbsG, fatG })));

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <div className="card p-3">
          <div className="photo-frame mb-3">
            {preview ? (
              <img src={preview} alt="Your meal" />
            ) : (
              <div className="photo-empty text-center text-body-secondary">
                <i className="bi bi-camera fs-1 d-block mb-2" aria-hidden="true" />
                Take a photo from above with the whole plate in view.
              </div>
            )}
            {phase === 'analysing' && (
              <div className="photo-busy" role="status">
                <div className="spinner-border text-light mb-2" aria-hidden="true" />
                <div>Identifying foods and estimating portions…</div>
              </div>
            )}
          </div>
          <div className="d-flex flex-wrap gap-2">
            <label className="btn btn-success flex-grow-1 mb-0">
              <i className="bi bi-camera" /> {preview ? 'Retake' : 'Take photo'}
              <input type="file" accept="image/*" capture="environment" id="photo-camera" className="d-none"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void choose(f); }} disabled={phase === 'analysing'} />
            </label>
            <label className="btn btn-outline-secondary flex-grow-1 mb-0">
              <i className="bi bi-image" /> Choose from library
              <input type="file" accept="image/*" id="photo-library" className="d-none"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void choose(f); }} disabled={phase === 'analysing'} />
            </label>
          </div>
          <div className="mt-3">
            <label htmlFor="photo-note" className="form-label small">Anything the photo doesn&apos;t show? <span className="text-body-secondary">(optional)</span></label>
            <input id="photo-note" className="form-control" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. cooked in olive oil, I only ate half" disabled={phase === 'analysing'} />
          </div>
          <button type="button" className="btn btn-success btn-lg w-100 mt-3" id="photo-analyse" onClick={() => void analyse()}
            disabled={!blob || phase === 'analysing' || remaining <= 0}>
            {phase === 'analysing' ? <><span className="spinner-border spinner-border-sm me-1" aria-hidden="true" /> Estimating…</> : <><i className="bi bi-stars" /> Estimate calories</>}
          </button>
          <div className="text-danger small mt-2" id="photo-error" role="alert">{error}</div>
          <div className="small text-body-secondary mt-2">
            {remaining > 0 ? `${remaining} of ${dailyLimit} estimates left today.` : "You've used today's estimates. You can still add food manually or scan barcodes."}
            {' '}Photos are analysed by Claude (Anthropic) and aren&apos;t stored by CalorieCopilot.
          </div>
        </div>
      </div>

      <div className="col-lg-7">
        {phase !== 'review' ? (
          <div className="card p-4 text-body-secondary">
            <h2 className="h6 text-body">Tips for a better estimate</h2>
            <ul className="mb-0 small">
              <li>Shoot from above, with the whole plate and a fork or hand in frame for scale.</li>
              <li>Spread foods out so each one is visible.</li>
              <li>Mention hidden extras like oil, butter, sauces or sugar in the note.</li>
            </ul>
          </div>
        ) : (
          <form ref={reviewRef} action={action} className="card" id="estimate-form">
            <div className="card-body">
              <FormAlert state={state} />
              <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                <h2 className="h5 mb-0">Here&apos;s what we see</h2>
                <span className="badge text-bg-light border">AI estimate</span>
              </div>
              <p className="small text-body-secondary">Portions are judged from the photo, so check them. Edit anything that looks off, and untick what you didn&apos;t eat.</p>
              {notes && <div className="alert alert-light border small py-2" id="estimate-notes"><i className="bi bi-info-circle" /> {notes}</div>}

              <input type="hidden" name="items" value={payload} />
              <input type="hidden" name="date" value={date} />
              <div className="vstack gap-3">
                {rows.map((r, i) => (
                  <fieldset key={i} className={`estimate-item border rounded-3 p-3 ${r.include ? '' : 'opacity-50'}`}>
                    <legend className="visually-hidden">{r.name}</legend>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <input className="form-check-input mt-0 flex-shrink-0" type="checkbox" checked={r.include} id={`inc-${i}`}
                        onChange={(e) => update(i, { include: e.target.checked })} aria-label={`Include ${r.name}`} />
                      <input className="form-control form-control-sm fw-semibold" value={r.name} maxLength={120} aria-label="Food name"
                        onChange={(e) => update(i, { name: e.target.value })} />
                      <span className={`badge ${CONFIDENCE_BADGE[r.confidence]} flex-shrink-0`} title="How sure the estimate is">{r.confidence}</span>
                    </div>
                    <input className="form-control form-control-sm mb-2" value={r.portion} maxLength={60} aria-label="Portion"
                      onChange={(e) => update(i, { portion: e.target.value })} />
                    <div className="row g-2">
                      {([['calories', 'kcal', ''], ['proteinG', 'Protein g', 'bg-protein'], ['carbsG', 'Carbs g', 'bg-carbs'], ['fatG', 'Fat g', 'bg-fat']] as const).map(([k, label, swatch]) => (
                        <div className="col-6 col-sm-3" key={k}>
                          <label className="form-label small mb-1" htmlFor={`${k}-${i}`}>{swatch && <span className={`swatch ${swatch}`} />}{label}</label>
                          <input id={`${k}-${i}`} className="form-control form-control-sm" type="number" step="any" min="0" max={k === 'calories' ? 10000 : 1000}
                            value={r[k]} onChange={(e) => update(i, { [k]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="row g-2 align-items-end mt-3">
                <div className="col-sm-6">
                  <label htmlFor="estimate-meal" className="form-label">Meal</label>
                  <select id="estimate-meal" name="meal" className="form-select" value={selectedMeal} onChange={(e) => setSelectedMeal(e.target.value as Meal)}>
                    {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-sm-6 small text-body-secondary text-sm-end">
                  P {n0(total('proteinG'))} g · C {n0(total('carbsG'))} g · F {n0(total('fatG'))} g
                </div>
              </div>
            </div>
            <div className="card-footer bg-transparent d-flex align-items-center justify-content-between py-3">
              <div><span className="text-body-secondary small">Total</span> <span className="fs-4 fw-bold" id="estimate-total">{n0(total('calories'))}</span> <span className="text-body-secondary">kcal</span></div>
              <SubmitButton disabled={included.length === 0}><i className="bi bi-plus-lg" /> Add {included.length} to diary</SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
