import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import './globals.css';
import { Flash } from '@/components/Flash';
import { NavBar } from '@/components/NavBar';
import { TabBar } from '@/components/TabBar';
import { getCurrentUser } from '@/lib/auth';
import { FLASH_COOKIE } from '@/lib/flash';

export const metadata: Metadata = {
  title: { default: 'CalorieCopilot', template: '%s · CalorieCopilot' },
  description: 'Daily calorie tracking with barcode scanning and analytics.',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/img/favicon.svg', type: 'image/svg+xml' },
      { url: '/img/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/img/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#176653',
};

// Applies the saved/OS colour theme before first paint to avoid a flash.
const themeScript = `(function(){var t=null;try{t=localStorage.getItem('cc-theme')}catch(e){}if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-bs-theme',t)})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const rawFlash = (await cookies()).get(FLASH_COOKIE)?.value;

  return (
    <html lang="en" data-bs-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={user ? 'has-tabbar' : undefined}>
        <NavBar signedIn={!!user} />
        <main className="container py-4">
          <Flash raw={rawFlash ?? null} />
          {children}
        </main>
        {user ? (
          <TabBar />
        ) : (
          <footer className="border-top py-4 text-body-secondary small">
            <div className="container d-flex flex-wrap justify-content-between gap-2">
              <span>&copy; {new Date().getFullYear()} CalorieCopilot</span>
              <span>
                Product data from{' '}
                <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a> (ODbL)
              </span>
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}
