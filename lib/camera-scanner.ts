'use client';

/**
 * Camera barcode scanning for the browser.
 *
 * Decoding uses the native BarcodeDetector where the browser has one (Chrome on Android, via ML Kit) and
 * otherwise zxing-cpp compiled to WebAssembly (iPhone/iPad Safari, desktop Firefox and most desktops).
 * The WASM file is served from our own origin (/wasm), copied there from node_modules at build time.
 */

import { hasValidCheckDigit } from './barcode';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'] as const;
const SCAN_INTERVAL_MS = 120;
const MAX_DECODE_WIDTH = 1280;
/** Zooming in lets people hold the phone ~20 cm away, where phone cameras (notably recent iPhones) can focus. */
const PREFERRED_ZOOM = 2;

interface DetectedBarcode { rawValue: string; format: string }
interface Detector { detect(source: CanvasImageSource | ImageBitmap | Blob): Promise<DetectedBarcode[]> }

let detectorPromise: Promise<Detector> | null = null;

/** Creates (once) the best available detector and starts downloading the WASM decoder if needed. */
export function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
    if (Native) {
      try {
        const supported = await Native.getSupportedFormats();
        if (supported.includes('ean_13') && supported.includes('upc_a')) {
          return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
        }
      } catch { /* fall back to WASM */ }
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
    await prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? `/wasm/${path}` : prefix + path) },
      fireImmediately: true,
    });
    return new BarcodeDetector({ formats: [...FORMATS] }) as unknown as Detector;
  })().catch((err) => {
    detectorPromise = null;
    throw err;
  });
  return detectorPromise;
}

/** First barcode in the results whose check digit is valid (anything else is a misread). */
function pick(results: DetectedBarcode[]): string | null {
  for (const r of results) {
    const code = r.rawValue.trim();
    if (/^\d{6,14}$/.test(code) && hasValidCheckDigit(code)) return code;
  }
  return null;
}

/** Decodes a still image, e.g. a photo the user picked. */
export async function scanImage(file: Blob): Promise<string | null> {
  const detector = await getDetector();
  const bitmap = await createImageBitmap(file);
  try {
    // Large phone photos: also try a downscaled copy, which helps decoders with blur and noise.
    const attempts: (ImageBitmap | HTMLCanvasElement)[] = [bitmap];
    if (bitmap.width > MAX_DECODE_WIDTH) attempts.push(drawScaled(bitmap, 0, 0, bitmap.width, bitmap.height, MAX_DECODE_WIDTH));
    for (const source of attempts) {
      const code = pick(await detector.detect(source));
      if (code) return code;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

function drawScaled(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, maxWidth: number, canvas = document.createElement('canvas')) {
  const scale = Math.min(1, maxWidth / sw);
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface CameraFeatures { torch: boolean; zoom: { min: number; max: number } | null; cameras: number }

type TrackCapabilities = MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number } };

/** Runs the camera into a <video> element and calls onCode with the first valid barcode it reads. */
export class CameraScanner {
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private frame = 0;
  private canvas: HTMLCanvasElement | null = null;
  private deviceIndex = -1;
  private devices: MediaDeviceInfo[] = [];

  constructor(private video: HTMLVideoElement, private onCode: (code: string) => void) {}

  async start(): Promise<CameraFeatures> {
    this.stopped = false;
    const detector = getDetector(); // start the WASM download in parallel with the camera prompt
    const deviceId = this.deviceIndex >= 0 ? this.devices[this.deviceIndex]?.deviceId : undefined;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        // Not in the TS lib yet; supported by Chrome/Android and ignored elsewhere.
        advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
      },
    });
    if (this.stopped) { this.release(); throw new DOMException('Stopped', 'AbortError'); }

    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', 'true'); // required for inline video on iOS
    this.video.muted = true;
    await this.video.play();

    this.devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const track = this.stream.getVideoTracks()[0];
    const caps = (track.getCapabilities?.() ?? {}) as TrackCapabilities;
    const zoom = caps.zoom && caps.zoom.max > caps.zoom.min ? { min: caps.zoom.min, max: caps.zoom.max } : null;
    if (zoom) await this.setZoom(Math.min(PREFERRED_ZOOM, zoom.max));

    const d = await detector;
    this.loop(d);
    return { torch: !!caps.torch, zoom, cameras: this.devices.length };
  }

  private loop(detector: Detector) {
    if (this.stopped) return;
    this.timer = setTimeout(async () => {
      try {
        const code = await this.decodeFrame(detector);
        if (code && !this.stopped) {
          this.stop();
          this.onCode(code);
          return;
        }
      } catch { /* a bad frame; keep going */ }
      this.loop(detector);
    }, SCAN_INTERVAL_MS);
  }

  private async decodeFrame(detector: Detector): Promise<string | null> {
    const v = this.video;
    if (v.readyState < 2 || !v.videoWidth) return null;
    this.frame++;
    // Alternate between the on-screen target box (centre band: sharper, faster) and the whole frame.
    const full = this.frame % 3 === 0;
    const sw = full ? v.videoWidth : Math.round(v.videoWidth * 0.9);
    const sh = full ? v.videoHeight : Math.round(v.videoHeight * 0.6);
    const sx = Math.round((v.videoWidth - sw) / 2);
    const sy = Math.round((v.videoHeight - sh) / 2);
    this.canvas = drawScaled(v, sx, sy, sw, sh, MAX_DECODE_WIDTH, this.canvas ?? undefined);
    return pick(await detector.detect(this.canvas));
  }

  async setZoom(level: number) {
    const track = this.stream?.getVideoTracks()[0];
    if (track) await track.applyConstraints({ advanced: [{ zoom: level } as MediaTrackConstraintSet] }).catch(() => {});
  }

  async setTorch(on: boolean) {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) throw new Error('Camera is not running');
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
  }

  /** Cycles to the next camera; call start() again afterwards. */
  nextCamera() {
    if (this.devices.length > 1) this.deviceIndex = (this.deviceIndex + 1) % this.devices.length;
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.release();
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
