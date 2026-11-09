import 'server-only';
import { cookies } from 'next/headers';

export const FLASH_COOKIE = 'cc_flash';

/** One-shot message shown after a redirect (read and cleared by the <Flash> client component). */
export async function setFlash(type: 'success' | 'danger', text: string) {
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(JSON.stringify({ type, text })), {
    path: '/',
    maxAge: 60,
    sameSite: 'lax',
    httpOnly: false,
  });
}
