// Copies the zxing-cpp WebAssembly decoder into public/wasm so the scanner loads it from our own
// origin instead of a CDN. Runs before `next dev` and `next build` (see package.json).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// zxing-wasm exports the file directly, so this follows whichever version is installed.
const wasm = require.resolve('zxing-wasm/reader/zxing_reader.wasm');
mkdirSync('public/wasm', { recursive: true });
copyFileSync(wasm, 'public/wasm/zxing_reader.wasm');
console.log('Copied zxing_reader.wasm to public/wasm');
