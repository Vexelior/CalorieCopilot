(function () {
    const $ = (id) => document.getElementById(id);
    const form = $('result-form');
    const input = (name) => form.querySelector(`[name="Input.${name}"]`);
    const els = {
        idle: $('scanner-idle'), overlay: $('scanner-overlay'), start: $('start-scan'), stop: $('stop-scan'),
        switchCam: $('switch-camera'), torch: $('torch'), error: $('scan-error'), file: $('scan-file'),
        empty: $('result-empty'), loading: $('result-loading'), loadingCode: $('loading-code'),
        image: $('product-image'), code: $('product-code'), source: $('product-source'), title: $('product-title'),
        notFound: $('not-found'), basisGroup: $('basis-group'), basisServingLabel: $('basis-serving-label'),
        saveGroup: $('save-product-group'), total: $('scan-total'),
    };

    const formats = [
        Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.ITF,
    ];
    const scanner = new Html5Qrcode('reader', {
        formatsToSupport: formats,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
    });

    let cameras = [];
    let cameraIndex = -1;
    let torchOn = false;
    let product = null;
    let handling = false;

    const show = (el, visible) => el.classList.toggle('d-none', !visible);
    const setError = (msg) => { els.error.textContent = msg || ''; };
    const round1 = (n) => Math.round(n * 10) / 10;

    /** Validates the GS1 check digit for EAN-8, UPC-A (12), EAN-13 and GTIN-14. */
    function validGtin(code) {
        if (!/^\d+$/.test(code)) return false;
        if (![8, 12, 13, 14].includes(code.length)) return code.length >= 6 && code.length <= 14;
        const digits = code.split('').map(Number);
        const check = digits.pop();
        const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
        return (10 - (sum % 10)) % 10 === check;
    }

    // ---- Camera ------------------------------------------------------------------------------------

    async function startCamera() {
        setError('');
        if (!window.isSecureContext) {
            setError('Camera access needs HTTPS. Use "Scan from photo" or type the number instead.');
            return;
        }
        try {
            if (cameras.length === 0) {
                cameras = await Html5Qrcode.getCameras();
            }
            const config = { fps: 12, aspectRatio: 4 / 3, disableFlip: true };
            const camera = cameraIndex >= 0 && cameras[cameraIndex] ? cameras[cameraIndex].id : { facingMode: 'environment' };
            await scanner.start(camera, config, onDetected, () => { });
            show(els.idle, false); show(els.overlay, true); show(els.stop, true);
            show(els.switchCam, cameras.length > 1);
            try {
                const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
                show(els.torch, torch.isSupported());
            } catch (e) { show(els.torch, false); }
        } catch (err) {
            console.warn(err);
            setError('Could not start the camera. Check browser permissions, or use "Scan from photo".');
            show(els.idle, true);
        }
    }

    async function stopCamera() {
        if (scanner.isScanning) {
            try { await scanner.stop(); } catch (e) { /* already stopped */ }
        }
        torchOn = false;
        show(els.idle, true); show(els.overlay, false);
        [els.stop, els.switchCam, els.torch].forEach((b) => show(b, false));
    }

    async function onDetected(code) {
        if (handling || !validGtin(code)) return;
        handling = true;
        if (navigator.vibrate) navigator.vibrate(80);
        await stopCamera();
        await lookup(code);
        handling = false;
    }

    els.start.addEventListener('click', startCamera);
    els.stop.addEventListener('click', stopCamera);
    els.switchCam.addEventListener('click', async () => {
        cameraIndex = (cameraIndex + 1) % cameras.length;
        await stopCamera();
        await startCamera();
    });
    els.torch.addEventListener('click', async () => {
        try {
            torchOn = !torchOn;
            await scanner.getRunningTrackCameraCapabilities().torchFeature().apply(torchOn);
            els.torch.classList.toggle('active', torchOn);
        } catch (e) { setError('Torch is not available on this camera.'); }
    });

    els.file.addEventListener('change', async () => {
        const file = els.file.files && els.file.files[0];
        if (!file) return;
        setError('');
        await stopCamera();
        try {
            const code = await scanner.scanFile(file, false);
            await lookup(code);
        } catch (e) {
            setError('No barcode found in that photo. Try again with the barcode filling more of the frame.');
        } finally {
            els.file.value = '';
        }
    });

    $('manual-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = $('manual-code').value.replace(/\s+/g, '');
        if (!/^\d{6,14}$/.test(code)) { setError('Barcodes are 6-14 digits.'); return; }
        setError('');
        await stopCamera();
        await lookup(code);
    });

    $('scan-again').addEventListener('click', async () => {
        show(form, false); show(els.empty, true);
        await startCamera();
    });

    // ---- Lookup & form -------------------------------------------------------------------------------

    async function lookup(code) {
        show(els.empty, false); show(form, false); show(els.loading, true);
        els.loadingCode.textContent = code;
        let data = null;
        try {
            const res = await fetch(`/api/products/${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' } });
            if (res.status === 401) { location.href = '/Account/Login?returnUrl=/Scan'; return; }
            if (res.ok) data = await res.json();
            else if (res.status !== 404) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            show(els.loading, false); show(els.empty, true);
            setError('Lookup failed. Check your connection and try again.');
            return;
        }
        show(els.loading, false);
        fill(code, data);
    }

    function perServing(p) {
        const g = p.servingGrams;
        const from100 = (v) => (v != null && g ? round1(v * g / 100) : null);
        const kcal = p.caloriesPerServing ?? from100(p.caloriesPer100g);
        if (kcal == null) return null;
        return {
            calories: kcal,
            protein: p.proteinPerServing ?? from100(p.proteinPer100g) ?? 0,
            carbs: p.carbsPerServing ?? from100(p.carbsPer100g) ?? 0,
            fat: p.fatPerServing ?? from100(p.fatPer100g) ?? 0,
        };
    }

    function applyBasis(basis) {
        if (!product) return;
        if (basis === 'serving') {
            const s = perServing(product);
            setNutrition(s.calories, s.protein, s.carbs, s.fat);
            input('ServingDescription').value = product.servingDescription || (product.servingGrams ? `${product.servingGrams} g` : 'serving');
        } else {
            setNutrition(product.caloriesPer100g, product.proteinPer100g ?? 0, product.carbsPer100g ?? 0, product.fatPer100g ?? 0);
            input('ServingDescription').value = '100 g';
        }
        updateTotal();
    }

    function setNutrition(kcal, p, c, f) {
        input('Calories').value = kcal != null ? round1(kcal) : '';
        input('ProteinG').value = round1(p || 0);
        input('CarbsG').value = round1(c || 0);
        input('FatG').value = round1(f || 0);
    }

    function fill(code, data) {
        product = data;
        input('Barcode').value = code;
        input('Servings').value = 1;
        els.code.textContent = code;

        if (data) {
            els.title.textContent = data.name;
            els.source.textContent = data.isCustom ? 'Saved by you' : 'Open Food Facts';
            input('Name').value = data.name;
            input('Brand').value = data.brand || '';
            if (data.imageUrl) { els.image.src = data.imageUrl; show(els.image, true); } else { show(els.image, false); }
            show(els.notFound, false); show(els.saveGroup, false);
            form.querySelector('[name="SaveProduct"]').checked = false;

            const hasServing = perServing(data) != null;
            const has100 = data.caloriesPer100g != null;
            show(els.basisGroup, hasServing && has100);
            els.basisServingLabel.textContent = data.servingDescription ? `(${data.servingDescription})` : '';
            const basis = hasServing ? 'serving' : '100g';
            $(basis === 'serving' ? 'basis-serving' : 'basis-100g').checked = true;
            if (hasServing || has100) applyBasis(basis);
            else { setNutrition(null, 0, 0, 0); input('ServingDescription').value = data.servingDescription || ''; }
        } else {
            els.title.textContent = 'Unknown product';
            els.source.textContent = 'Not found';
            ['Name', 'Brand', 'ServingDescription'].forEach((k) => { input(k).value = ''; });
            setNutrition(null, 0, 0, 0);
            show(els.image, false); show(els.basisGroup, false);
            show(els.notFound, true); show(els.saveGroup, true);
            form.querySelector('[name="SaveProduct"]').checked = true;
        }

        updateTotal();
        show(form, true);
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        (data ? input('Servings') : input('Name')).focus({ preventScroll: true });
    }

    function updateTotal() {
        const kcal = (parseFloat(input('Calories').value) || 0) * (parseFloat(input('Servings').value) || 0);
        els.total.textContent = Math.round(kcal).toLocaleString();
    }

    form.addEventListener('input', updateTotal);
    form.querySelectorAll('input[name="basis"]').forEach((r) => r.addEventListener('change', () => applyBasis(r.value)));
    form.querySelectorAll('[data-step]').forEach((btn) => btn.addEventListener('click', () => {
        const el = input('Servings');
        const next = Math.max(0.5, (parseFloat(el.value) || 0) + parseFloat(btn.dataset.step));
        el.value = round1(next);
        updateTotal();
    }));

    window.addEventListener('pagehide', stopCamera);
})();
