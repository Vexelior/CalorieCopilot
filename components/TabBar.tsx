'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './NavBar';

/** Bottom tab bar on phones. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar d-md-none border-top bg-body" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? 'active' : ''}
          aria-current={pathname.startsWith(item.href) ? 'page' : undefined}>
          <i className={`bi ${item.icon}`} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
