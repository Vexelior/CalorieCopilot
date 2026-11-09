'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { addScannedEntry } from '@/app/actions/diary';
import { FieldError, FormAlert, SubmitButton, fieldClass } from '@/components/forms';
import { n0 } from '@/lib/format';
import { MEALS, type Meal, type ProductDto } from '@/lib/types';

type Phase = 'empty' | 'loading' | 'result';
type Basis = 'serving' | '100g';

interface FormFields {
  barcode: string; name: string; brand: string; servingDescription: string; servings: string;
  calories: string; proteinG: string; carbsG: string; fatG: string; meal: Meal; saveProduct: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number | null | undefined) => (n == null ? '' : String(round1(n)));

/** Validates the GS1 check digit for EAN-8, UPC-A (12), EAN-13 and GTIN-14. */
function validGtin(code: string) {
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return code.length >= 6 && code.length <= 14;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function perServing(p: ProductDto) {
  const g = p.servingGrams;
  const from100 = (v: number | null) => (v != null && g ? round1((v * g) / 100) : null);
  const kcal = p.caloriesPerServing ?? from100(p.caloriesPer100g);
  if (kcal == null) return null;
  return {
    calories: kcal,
    protein: p.proteinPerServing ?? from100(p.proteinPer100g) ?? 0,
    carbs: p.carbsPerServing ?? from100(p.carbsPer100g) ?? 0,
    fat: p.fatPerServing ?? from100(p.fatPer100g) ?? 0,
  };
}

export function Scanner({ date, meal }: { date: string; meal: Meal }) {
  const [state, action] = useActionState(addScannedEntry, undefined);
  const [phase, setPhase] = useState<Phase>('empty');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [loadingCode, setLoadingCode] = useState('');
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [basis, setBasis] = useState<Basis>('serving');
  const [manualCode, setManualCode] = useState('');
  const [cameras, setCameras] = useState<{ id: string }[]>([]);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [fields, setFields] = useState<FormFields>({
    barcode: '', name: '', brand: '', servingDescription: '', servings: '1', calories: '', proteinG: '', carbsG: '', fatG: '', meal, saveProduct: true,
  });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraIndex = useRef(-1);
  const handling = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof FormFields>(key: K, value: FormFields[K]) => setFields((f) => ({ ...f, [key]: value }));

  // If the server rejected the submission, put the submitted values back.
  useEffect(() => {
    const v = state?.values;
    if (v) setFields((f) => ({ ...f, ...v, meal: (v.meal as Meal) ?? f.meal, saveProduct: v.saveProduct === 'on' }));
  }, [state]);

  const getScanner = useCallback(async () => {
    if (scannerRef.current) return scannerRef.current;
    const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import('html5-qrcode');
    scannerRef.current = new Html5Qrcode('reader', {
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.ITF],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      verbose: false,
    });
    return scannerRef.current;
  }, []);

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    if (s?.isScanning) {
      try { await s.stop(); } catch { /* already stopped */ }
    }
    setScanning(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  useEffect(() => () => { void stopCamera(); }, [stopCamera]);

  const applyBasis = useCallback((p: ProductDto, b: Basis) => {
    if (b === 'serving') {
      const s = perServing(p)!;
      setFields((f) => ({
        ...f, calories: fmt(s.calories), proteinG: fmt(s.protein), carbsG: fmt(s.carbs), fatG: fmt(s.fat),
        servingDescription: p.servingDescription || (p.servingGrams ? `${p.servingGrams} g` : 'serving'),
      }));
    } else {
      setFields((f) => ({
        ...f, calories: fmt(p.caloriesPer100g), proteinG: fmt(p.proteinPer100g ?? 0), carbsG: fmt(p.carbsPer100g ?? 0), fatG: fmt(p.fatPer100g ?? 0),
        servingDescription: '100 g',
      }));
    }
    setBasis(b);
  }, []);

  const showResult = useCallback((code: string, p: ProductDto | null) => {
    setProduct(p);
    setFields((f) => ({
      ...f, barcode: code, servings: '1', name: p?.name ?? '', brand: p?.brand ?? '', servingDescription: p?.servingDescription ?? '',
      calories: '', proteinG: '0', carbsG: '0', fatG: '0', saveProduct: !p,
    }));
    if (p) {
      const hasServing = perServing(p) != null;
      if (hasServing) applyBasis(p, 'serving');
      else if (p.caloriesPer100g != null) applyBasis(p, '100g');
    }
    setPhase('result');
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current?.querySelector<HTMLInputElement>(p ? '#Input_Servings' : '#Input_Name')?.focus({ preventScroll: true });
    });
  }, [applyBasis]);

  const lookup = useCallback(async (code: string) => {
    setPhase('loading');
    setLoadingCode(code);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' } });
      if (res.status === 401) { window.location.href = '/login?returnUrl=/scan'; return; }
      if (res.ok) return showResult(code, (await res.json()) as ProductDto);
      if (res.status === 404) return showResult(code, null);
      throw new Error(`HTTP ${res.status}`);
    } catch {
      setPhase('empty');
      setError('Lookup failed. Check your connection and try again.');
    }
  }, [showResult]);

  const onDetected = useCallback(async (code: string) => {
    if (handling.current || !validGtin(code)) return;
    handling.current = true;
    navigator.vibrate?.(80);
    await stopCamera();
    await lookup(code);
    handling.current = false;
  }, [lookup, stopCamera]);

  const startCamera = useCallback(async () => {
    setError('');
    if (!window.isSecureContext) {
      setError('Camera access needs HTTPS. Use "Scan from photo" or type the number instead.');
      return;
    }
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      let list = cameras;
      if (list.length === 0) {
        list = await Html5Qrcode.getCameras();
        setCameras(list);
      }
      const scanner = await getScanner();
      const camera = cameraIndex.current >= 0 && list[cameraIndex.current] ? list[cameraIndex.current].id : { facingMode: 'environment' };
      await scanner.start(camera, { fps: 12, aspectRatio: 4 / 3, disableFlip: true }, (text) => { void onDetected(text); }, () => {});
      setScanning(true);
      try { setTorchSupported(scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported()); } catch { setTorchSupported(false); }
    } catch (err) {
      console.warn(err);
      setError('Could not start the camera. Check browser permissions, or use "Scan from photo".');
    }
  }, [cameras, getScanner, onDetected]);

  const switchCamera = async () => {
    cameraIndex.current = (cameraIndex.current + 1) % cameras.length;
    await stopCamera();
    await startCamera();
  };

  const toggleTorch = async () => {
    try {
      await scannerRef.current?.getRunningTrackCameraCapabilities().torchFeature().apply(!torchOn);
      setTorchOn(!torchOn);
    } catch { setError('Torch is not available on this camera.'); }
  };

  const scanFile = async (file: File) => {
    setError('');
    await stopCamera();
    try {
      const scanner = await getScanner();
      await lookup(await scanner.scanFile(file, false));
    } catch {
      setError('No barcode found in that photo. Try again with the barcode filling more of the frame.');
    }
  };

  const onManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.replace(/\s+/g, '');
    if (!/^\d{6,14}$/.test(code)) { setError('Barcodes are 6-14 digits.'); return; }
    setError('');
    await stopCamera();
    await lookup(code);
  };

  const hasBoth = !!product && perServing(product) != null && product.caloriesPer100g != null;
  const total = (parseFloat(fields.calories) || 0) * (parseFloat(fields.servings) || 0);

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <div className="card p-3">
          <div className="scanner-frame w-100">
            <div id="reader" />
            {scanning && <div className="scanner-overlay" id="scanner-overlay"><div className="target" /><div className="laser" /></div>}
            {!scanning && (
              <div className="scanner-idle" id="scanner-idle">
                <i className="bi bi-camera-video fs-1" />
                <button type="button" className="btn btn-success btn-lg" id="start-scan" onClick={() => void startCamera()}><i className="bi bi-upc-scan" /> Start camera</button>
                <small className="text-white-50 px-4">Camera access needs HTTPS (or localhost). Nothing is recorded or uploaded.</small>
              </div>
            )}
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3">
            {scanning && <button type="button" className="btn btn-outline-secondary" onClick={() => void stopCamera()}><i className="bi bi-stop-circle" /> Stop</button>}
            {scanning && cameras.length > 1 && <button type="button" className="btn btn-outline-secondary" onClick={() => void switchCamera()}><i className="bi bi-arrow-repeat" /> Switch camera</button>}
            {scanning && torchSupported && <button type="button" className={`btn btn-outline-secondary ${torchOn ? 'active' : ''}`} onClick={() => void toggleTorch()}><i className="bi bi-lightbulb" /> Torch</button>}
            <label className="btn btn-outline-secondary mb-0 ms-auto">
              <i className="bi bi-image" /> Scan from photo
              <input type="file" accept="image/*" capture="environment" id="scan-file" className="d-none"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void scanFile(f); }} />
            </label>
          </div>
          <div className="text-danger small mt-2" id="scan-error" role="alert">{error}</div>
          <hr />
          <form id="manual-form" className="input-group" autoComplete="off" onSubmit={onManual}>
            <span className="input-group-text"><i className="bi bi-upc" /></span>
            <input type="text" inputMode="numeric" pattern="\d{6,14}" className="form-control" id="manual-code" placeholder="Or type the barcode number"
              aria-label="Barcode number" required value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
            <button className="btn btn-success" type="submit">Look up</button>
          </form>
        </div>
      </div>

      <div className="col-lg-6">
        {phase === 'empty' && (
          <div className="card p-4 text-center text-body-secondary" id="result-empty">
            <i className="bi bi-upc-scan display-4 mb-2" />
            <p className="mb-0">Scan a product to see its nutrition facts here.</p>
          </div>
        )}
        {phase === 'loading' && (
          <div className="card p-4 text-center" id="result-loading">
            <div className="spinner-border text-success mx-auto mb-2" role="status"><span className="visually-hidden">Loading</span></div>
            <div>Looking up <span className="fw-semibold">{loadingCode}</span>…</div>
          </div>
        )}
        {phase === 'result' && (
          <form ref={formRef} action={action} className="card" id="result-form">
            <div className="card-body">
              <FormAlert state={state} />
              <div className="d-flex gap-3 align-items-center mb-3">
                {product?.imageUrl && (
                  // Remote product photo from Open Food Facts.
                  <img src={product.imageUrl} className="product-thumb border" alt="" referrerPolicy="no-referrer" />
                )}
                <div className="min-w-0">
                  <div className="small text-body-secondary">
                    <i className="bi bi-upc" /> <span id="product-code">{fields.barcode}</span>{' '}
                    <span id="product-source" className="badge text-bg-light border ms-1">{product ? (product.isCustom ? 'Saved by you' : 'Open Food Facts') : 'Not found'}</span>
                  </div>
                  <div className="fw-semibold fs-5 text-truncate" id="product-title">{product?.name ?? 'Unknown product'}</div>
                </div>
              </div>
              {!product && (
                <div className="alert alert-warning small" id="not-found">
                  <i className="bi bi-question-circle" /> This product isn&apos;t in the database yet. Enter its nutrition label below. We&apos;ll remember it for your next scan.
                </div>
              )}

              <input type="hidden" name="barcode" value={fields.barcode} />
              <input type="hidden" name="date" value={date} />
              <div className="row g-3">
                <div className="col-sm-7">
                  <label htmlFor="Input_Name" className="form-label">Food</label>
                  <input id="Input_Name" name="name" className={fieldClass(state, 'name')} required maxLength={120} value={fields.name} onChange={(e) => set('name', e.target.value)} />
                  <FieldError state={state} name="name" />
                </div>
                <div className="col-sm-5">
                  <label htmlFor="Input_Brand" className="form-label">Brand</label>
                  <input id="Input_Brand" name="brand" className="form-control" maxLength={80} value={fields.brand} onChange={(e) => set('brand', e.target.value)} />
                </div>

                {hasBoth && (
                  <div className="col-12" id="basis-group">
                    <div className="form-label mb-1">Measure by</div>
                    <div className="btn-group w-100" role="group" aria-label="Nutrition basis">
                      <input type="radio" className="btn-check" name="basis" id="basis-serving" checked={basis === 'serving'} onChange={() => applyBasis(product!, 'serving')} />
                      <label className="btn btn-outline-success" htmlFor="basis-serving">Serving {product!.servingDescription && <span className="small">({product!.servingDescription})</span>}</label>
                      <input type="radio" className="btn-check" name="basis" id="basis-100g" checked={basis === '100g'} onChange={() => applyBasis(product!, '100g')} />
                      <label className="btn btn-outline-success" htmlFor="basis-100g">Per 100 g</label>
                    </div>
                  </div>
                )}

                <div className="col-7">
                  <label htmlFor="Input_ServingDescription" className="form-label">Serving size</label>
                  <input id="Input_ServingDescription" name="servingDescription" className="form-control" placeholder="e.g. 1 bar (40 g)" maxLength={60}
                    value={fields.servingDescription} onChange={(e) => set('servingDescription', e.target.value)} />
                </div>
                <div className="col-5">
                  <label htmlFor="Input_Servings" className="form-label">Servings</label>
                  <div className="input-group">
                    <button className="btn btn-outline-secondary" type="button" data-step="-0.5" aria-label="Fewer"
                      onClick={() => set('servings', String(Math.max(0.5, round1((parseFloat(fields.servings) || 0) - 0.5))))}><i className="bi bi-dash" /></button>
                    <input id="Input_Servings" name="servings" className={fieldClass(state, 'servings', 'form-control text-center')} type="number" step="any" min="0.01" max="100" required
                      value={fields.servings} onChange={(e) => set('servings', e.target.value)} />
                    <button className="btn btn-outline-secondary" type="button" data-step="0.5" aria-label="More"
                      onClick={() => set('servings', String(round1((parseFloat(fields.servings) || 0) + 0.5)))}><i className="bi bi-plus" /></button>
                  </div>
                  <FieldError state={state} name="servings" />
                </div>

                <div className="col-12"><div className="small text-body-secondary">Nutrition per serving</div></div>
                {([
                  ['calories', 'Input_Calories', 'kcal', '', 10000, true],
                  ['proteinG', 'Input_ProteinG', 'Protein g', 'bg-protein', 1000, false],
                  ['carbsG', 'Input_CarbsG', 'Carbs g', 'bg-carbs', 1000, false],
                  ['fatG', 'Input_FatG', 'Fat g', 'bg-fat', 1000, false],
                ] as const).map(([key, id, label, swatch, max, required]) => (
                  <div className="col-6 col-sm-3" key={key}>
                    <label htmlFor={id} className="form-label small">{swatch && <span className={`swatch ${swatch}`} />}{label}</label>
                    <input id={id} name={key} className={fieldClass(state, key)} type="number" step="any" min="0" max={max} required={required}
                      value={fields[key]} onChange={(e) => set(key, e.target.value)} />
                    <FieldError state={state} name={key} />
                  </div>
                ))}

                <div className="col-sm-6">
                  <label htmlFor="Input_Meal" className="form-label">Meal</label>
                  <select id="Input_Meal" name="meal" className="form-select" value={fields.meal} onChange={(e) => set('meal', e.target.value as Meal)}>
                    {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-sm-6 d-flex align-items-end">
                  {!product && (
                    <div className="form-check" id="save-product-group">
                      <input className="form-check-input" type="checkbox" id="SaveProduct" name="saveProduct" checked={fields.saveProduct} onChange={(e) => set('saveProduct', e.target.checked)} />
                      <label className="form-check-label" htmlFor="SaveProduct">Remember this product</label>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="card-footer bg-transparent d-flex align-items-center justify-content-between py-3">
              <div><span className="text-body-secondary small">Total</span> <span className="fs-4 fw-bold" id="scan-total">{n0(total)}</span> <span className="text-body-secondary">kcal</span></div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" id="scan-again" onClick={() => { setPhase('empty'); void startCamera(); }}>
                  <i className="bi bi-arrow-counterclockwise" /> Rescan
                </button>
                <SubmitButton><i className="bi bi-plus-lg" /> Add to diary</SubmitButton>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
