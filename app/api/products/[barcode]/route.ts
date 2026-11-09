import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchOffProduct } from '@/lib/openfoodfacts';
import { findProduct, isValidBarcode, toDto, upsertProduct } from '@/lib/products';

const CACHE_DAYS = 30;

/** Barcode lookup for the scanner: cache / user's own products first, then Open Food Facts (cached). */
export async function GET(_req: Request, ctx: RouteContext<'/api/products/[barcode]'>) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { barcode } = await ctx.params;
  if (!isValidBarcode(barcode)) return NextResponse.json({ error: 'Barcodes must be 6-14 digits.' }, { status: 400 });

  const cached = await findProduct(barcode, user.id);
  const fresh = cached && (cached.ownerId !== '' || Date.parse(cached.updatedAt) > Date.now() - CACHE_DAYS * 86_400_000);
  if (cached && fresh) return NextResponse.json(toDto(cached));

  const remote = await fetchOffProduct(barcode);
  if (remote) {
    await upsertProduct(remote);
    return NextResponse.json(toDto({ ...remote, updatedAt: new Date().toISOString() }));
  }
  // A stale cache entry is better than nothing.
  return cached ? NextResponse.json(toDto(cached)) : NextResponse.json({ barcode }, { status: 404 });
}
