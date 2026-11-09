import 'server-only';
import type { Product } from './types';

const FIELDS = 'code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments,image_front_small_url';
const BASE_URL = (process.env.OPEN_FOOD_FACTS_URL ?? 'https://world.openfoodfacts.org').replace(/\/+$/, '');

type Json = Record<string, unknown>;

const str = (o: Json | undefined, key: string) => {
  const v = o?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

const num = (o: Json | undefined, key: string) => {
  const v = o?.[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};

const kjToKcal = (kj: number | null) => (kj == null ? null : Math.round((kj / 4.184) * 10) / 10);

export function parseOffProduct(barcode: string, body: unknown): Omit<Product, 'updatedAt'> | null {
  const p = (body as Json | null)?.product as Json | undefined;
  if (!p || typeof p !== 'object') return null;
  const name = str(p, 'product_name') ?? str(p, 'generic_name');
  if (!name) return null;
  const n = (p.nutriments ?? {}) as Json;
  const servingGrams = num(p, 'serving_quantity');
  return {
    barcode,
    ownerId: '',
    name,
    brand: str(p, 'brands')?.split(',')[0].trim() || null,
    servingDescription: str(p, 'serving_size'),
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : null,
    caloriesPer100g: num(n, 'energy-kcal_100g') ?? kjToKcal(num(n, 'energy_100g')),
    proteinPer100g: num(n, 'proteins_100g'),
    carbsPer100g: num(n, 'carbohydrates_100g'),
    fatPer100g: num(n, 'fat_100g'),
    caloriesPerServing: num(n, 'energy-kcal_serving') ?? kjToKcal(num(n, 'energy_serving')),
    proteinPerServing: num(n, 'proteins_serving'),
    carbsPerServing: num(n, 'carbohydrates_serving'),
    fatPerServing: num(n, 'fat_serving'),
    imageUrl: str(p, 'image_front_small_url'),
    source: 'openfoodfacts',
  };
}

/** Looks up a packaged food in the free Open Food Facts database. Returns null when unknown or unreachable. */
export async function fetchOffProduct(barcode: string): Promise<Omit<Product, 'updatedAt'> | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': 'CalorieCopilot/1.0 (+https://github.com/vexelior/caloriecopilot)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!res.ok) return null; // 404 = not found
    return parseOffProduct(barcode, await res.json());
  } catch (err) {
    console.warn(`Open Food Facts lookup failed for ${barcode}:`, err);
    return null;
  }
}
