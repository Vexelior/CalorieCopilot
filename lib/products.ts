import 'server-only';
import { execute, queryOne } from './db';
import type { Product, ProductDto } from './types';

type Row = Record<string, unknown>;
const COLUMNS =
  'Barcode, OwnerId, Name, Brand, ServingDescription, ServingGrams, CaloriesPer100g, ProteinPer100g, CarbsPer100g, FatPer100g, ' +
  'CaloriesPerServing, ProteinPerServing, CarbsPerServing, FatPerServing, ImageUrl, Source, UpdatedAt';

const optNum = (v: unknown) => (v == null ? null : Number(v));
const optStr = (v: unknown) => (v == null ? null : String(v));

export const isValidBarcode = (code: unknown): code is string => typeof code === 'string' && /^\d{6,14}$/.test(code);

function mapProduct(r: Row): Product {
  return {
    barcode: String(r.Barcode),
    ownerId: String(r.OwnerId ?? ''),
    name: String(r.Name),
    brand: optStr(r.Brand),
    servingDescription: optStr(r.ServingDescription),
    servingGrams: optNum(r.ServingGrams),
    caloriesPer100g: optNum(r.CaloriesPer100g),
    proteinPer100g: optNum(r.ProteinPer100g),
    carbsPer100g: optNum(r.CarbsPer100g),
    fatPer100g: optNum(r.FatPer100g),
    caloriesPerServing: optNum(r.CaloriesPerServing),
    proteinPerServing: optNum(r.ProteinPerServing),
    carbsPerServing: optNum(r.CarbsPerServing),
    fatPerServing: optNum(r.FatPerServing),
    imageUrl: optStr(r.ImageUrl),
    source: String(r.Source ?? ''),
    updatedAt: String(r.UpdatedAt ?? ''),
  };
}

export function toDto(p: Product): ProductDto {
  const { ownerId, updatedAt: _updatedAt, ...rest } = p;
  return { ...rest, isCustom: ownerId !== '' };
}

/**
 * Barcode -> product cache. Rows with an empty OwnerId come from Open Food Facts and are shared;
 * rows with an OwnerId are a user's own entries for products the public database doesn't know.
 * The user's own version wins.
 */
export async function findProduct(barcode: string, userId: string): Promise<Product | null> {
  const r = await queryOne<Row>(
    `SELECT ${COLUMNS} FROM Products WHERE Barcode = ? AND OwnerId IN ('', ?) ORDER BY OwnerId DESC LIMIT 1`,
    [barcode, userId],
  );
  return r ? mapProduct(r) : null;
}

export async function upsertProduct(p: Omit<Product, 'updatedAt'>) {
  await execute(
    `INSERT INTO Products (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ` +
      'ON CONFLICT (Barcode, OwnerId) DO UPDATE SET Name = excluded.Name, Brand = excluded.Brand, ServingDescription = excluded.ServingDescription, ' +
      'ServingGrams = excluded.ServingGrams, CaloriesPer100g = excluded.CaloriesPer100g, ProteinPer100g = excluded.ProteinPer100g, ' +
      'CarbsPer100g = excluded.CarbsPer100g, FatPer100g = excluded.FatPer100g, CaloriesPerServing = excluded.CaloriesPerServing, ' +
      'ProteinPerServing = excluded.ProteinPerServing, CarbsPerServing = excluded.CarbsPerServing, FatPerServing = excluded.FatPerServing, ' +
      'ImageUrl = excluded.ImageUrl, Source = excluded.Source, UpdatedAt = excluded.UpdatedAt',
    [
      p.barcode, p.ownerId, p.name, p.brand, p.servingDescription, p.servingGrams, p.caloriesPer100g, p.proteinPer100g, p.carbsPer100g,
      p.fatPer100g, p.caloriesPerServing, p.proteinPerServing, p.carbsPerServing, p.fatPerServing, p.imageUrl, p.source, new Date().toISOString(),
    ],
  );
}
