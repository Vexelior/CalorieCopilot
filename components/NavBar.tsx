'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { ThemeToggle } from './ThemeToggle';

export const NAV_ITEMS = [
  { href: '/diary', icon: 'bi-journal-text', label: 'Diary' },
  { href: '/scan', icon: 'bi-upc-scan', label: 'Scan' },
  { href: '/analytics', icon: 'bi-graph-up', label: 'Analytics' },
  { href: '/profile', icon: 'bi-person-circle', label: 'Profile' },
];

export function NavBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="navbar navbar-expand-md border-bottom bg-body sticky-top">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2" href={signedIn ? '/diary' : '/'}>
          <img src="/img/logo.svg" alt="" className="brand-logo" width={34} height={34} />
          <span className="wordmark">Calorie<span>Copilot</span></span>
        </Link>
        <div className="d-flex align-items-center gap-1 order-md-last">
          <ThemeToggle />
          {signedIn && (
            <form action={logout} className="d-none d-md-block">
              <button type="submit" className="btn btn-outline-secondary btn-sm"><i className="bi bi-box-arrow-right" /> Sign out</button>
            </form>
          )}
        </div>
        {signedIn ? (
          <ul className="navbar-nav me-auto ms-md-4 d-none d-md-flex flex-row gap-md-1">
            {NAV_ITEMS.map((item) => (
              <li className="nav-item" key={item.href}>
                <Link className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`} href={item.href}
                  aria-current={pathname.startsWith(item.href) ? 'page' : undefined}>
                  <i className={`bi ${item.icon}`} /> {item.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="ms-auto d-flex gap-2 me-1">
            <Link className="btn btn-outline-success btn-sm" href="/login">Sign in</Link>
            <Link className="btn btn-success btn-sm" href="/register">Get started</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
