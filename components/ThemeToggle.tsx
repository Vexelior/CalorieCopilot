'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-bs-theme') === 'dark');
  }, []);

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    try { localStorage.setItem('cc-theme', next); } catch { /* storage unavailable */ }
    setDark(!dark);
    document.dispatchEvent(new CustomEvent('cc:themechange', { detail: next }));
  };

  return (
    <button type="button" className="btn btn-link nav-link px-2" id="theme-toggle" onClick={toggle}
      aria-label="Toggle dark mode" title="Toggle dark mode">
      <i className={dark ? 'bi bi-sun' : 'bi bi-moon-stars'} />
    </button>
  );
}
