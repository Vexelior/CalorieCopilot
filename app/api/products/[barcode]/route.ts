import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canonicalBarcode } from '@/lib/barcode';
import { fetchOffProduct } from '@/lib/openfoodfacts';
import { findProduct, isValidBarcode, toDto, upsertProduct } from '@/lib/products';

const CACHE_DAYS = 30;

/** Barcode lookup for the scanner: cache / user's own products first, then Open Food Facts (cached). */
export async function GET(_req: Request, ctx: RouteContext<'/api/products/[barcode]'>) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { barcode: raw } = await ctx.params;
  if (!isValidBarcode(raw)) return NextResponse.json({ error: 'Barcodes must be 6-14 digits.' }, { status: 400 });

  // A 12-digit UPC-A and its 13-digit EAN form (leading 0) are the same product; store and look up the 13-digit form.
  const barcode = canonicalBarcode(raw);
  const cached = (await findProduct(barcode, user.id)) ?? (barcode !== raw ? await findProduct(raw, user.id) : null);
  const fresh = cached && (cached.ownerId !== '' || Date.parse(cached.updatedAt) > Date.now() - CACHE_DAYS * 86_400_000);
  if (cached && fresh) return NextResponse.json(toDto(cached));

  // Open Food Facts keys UPC-A products by their 13-digit form; try the code as scanned if that misses.
  const remote = (await fetchOffProduct(barcode)) ?? (barcode !== raw ? await fetchOffProduct(raw) : null);
  if (remote) {
    const product = { ...remote, barcode };
    await upsertProduct(product);
    return NextResponse.json(toDto({ ...product, updatedAt: new Date().toISOString() }));
  }
  // A stale cache entry is better than nothing.
  return cached ? NextResponse.json(toDto(cached)) : NextResponse.json({ barcode }, { status: 404 });
}
