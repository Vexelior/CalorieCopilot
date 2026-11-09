'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Message { type: 'success' | 'danger'; text: string }

function parse(raw: string | null): Message | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(decodeURIComponent(raw)) as Message;
    return m && typeof m.text === 'string' ? m : null;
  } catch {
    return null;
  }
}

/** Shows the one-shot message a server action left in the cc_flash cookie, then clears it. */
export function Flash({ raw }: { raw: string | null }) {
  const pathname = usePathname();
  const [message, setMessage] = useState<Message | null>(() => parse(raw));
  const lastRaw = useRef<string | null>(null);

  useEffect(() => {
    // A new cookie value means a fresh message (after a server action or redirect). Anything else,
    // such as moving to another page, means the current message is stale.
    const fresh = raw !== lastRaw.current ? parse(raw) : null;
    lastRaw.current = raw;
    setMessage(fresh);
    if (fresh) document.cookie = 'cc_flash=; Max-Age=0; path=/; SameSite=Lax';
  }, [raw, pathname]);

  if (!message) return null;
  const icon = message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
  return (
    <div className={`alert alert-${message.type} d-flex align-items-center gap-2`} role="alert">
      <i className={`bi ${icon}`} aria-hidden="true" />
      <div className="flex-grow-1">{message.text}</div>
      <button type="button" className="btn-close" aria-label="Close" onClick={() => setMessage(null)} />
    </div>
  );
}
