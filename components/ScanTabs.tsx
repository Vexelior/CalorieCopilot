import Link from 'next/link';

/** Switches between barcode scanning and photo estimates, keeping the chosen date and meal. */
export function ScanTabs({ active, date, meal }: { active: 'barcode' | 'photo'; date: string; meal: string }) {
  const q = `?date=${date}&meal=${meal}`;
  return (
    <nav className="nav nav-pills scan-tabs mb-3" aria-label="Ways to add food">
      <Link className={`nav-link ${active === 'barcode' ? 'active' : ''}`} href={`/scan${q}`} aria-current={active === 'barcode' ? 'page' : undefined}>
        <i className="bi bi-upc-scan" /> Barcode
      </Link>
      <Link className={`nav-link ${active === 'photo' ? 'active' : ''}`} href={`/scan/photo${q}`} aria-current={active === 'photo' ? 'page' : undefined}>
        <i className="bi bi-camera" /> Food photo
      </Link>
    </nav>
  );
}
