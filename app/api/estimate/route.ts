import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES, estimateFoodPhoto, photoEstimatesConfigured, recordEstimate, remainingEstimates,
  type SupportedImageType,
} from '@/lib/food-photo';

// A vision request with thinking usually takes 5-30 s.
export const maxDuration = 60;

/** POST multipart/form-data { image: File, note?: string } -> estimated foods with calories and macros. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!photoEstimatesConfigured()) return NextResponse.json({ error: 'Photo estimates are not set up on this server.' }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Send the photo as form data.' }, { status: 400 });
  }
  const image = form.get('image');
  const note = String(form.get('note') ?? '').trim().slice(0, 300);
  if (!(image instanceof File) || image.size === 0) return NextResponse.json({ error: 'Choose a photo first.' }, { status: 400 });
  if (!SUPPORTED_IMAGE_TYPES.includes(image.type as SupportedImageType)) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, WebP or GIF photo.' }, { status: 415 });
  }
  if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'That photo is too large. Try a smaller one.' }, { status: 413 });

  const remaining = await remainingEstimates(user.id);
  if (remaining <= 0) {
    return NextResponse.json({ error: "You've used today's photo estimates. You can still add food manually or scan barcodes." }, { status: 429 });
  }
  await recordEstimate(user.id);

  const base64 = Buffer.from(await image.arrayBuffer()).toString('base64');
  const result = await estimateFoodPhoto({ base64, mediaType: image.type as SupportedImageType }, note);
  if (!result.ok) return NextResponse.json({ error: result.error, remaining: remaining - 1 }, { status: result.status });
  return NextResponse.json({ ...result.estimate, remaining: remaining - 1 });
}
