import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalorieRing, MacroBar } from '@/components/CalorieRing';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  if (await getCurrentUser()) redirect('/diary');

  const features = [
    { icon: 'bi-journal-check', tone: 'bg-success-subtle text-success', title: 'Daily diary', text: 'Log breakfast, lunch, dinner and snacks, and watch your calories and macros against your goals.' },
    { icon: 'bi-upc-scan', tone: 'bg-primary-subtle text-primary', title: 'Barcode scanning', text: "Point your camera at a package and its nutrition facts fill in automatically from Open Food Facts." },
    { icon: 'bi-graph-up-arrow', tone: 'bg-warning-subtle text-warning-emphasis', title: 'Analytics', text: 'Trends, streaks, macro split, meal breakdown and weight history over 7, 30 or 90 days.' },
    { icon: 'bi-sliders', tone: 'bg-info-subtle text-info-emphasis', title: 'Personal goals', text: 'Get calorie and macro targets suggested from your body stats and activity level, or set your own.' },
  ];

  return (
    <>
      <section className="hero">
        <div className="row align-items-center g-4 g-lg-5">
          <div className="col-lg-6">
            <span className="badge rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle mb-3"><i className="bi bi-stars" /> Free and private</span>
            <h1 className="display-5 mb-3">Your copilot for <span className="text-success">daily nutrition</span>.</h1>
            <p className="lead text-body-secondary mb-4">Log meals in seconds, scan barcodes with your phone&apos;s camera, and see how your habits trend over time.</p>
            <div className="d-flex flex-wrap gap-2">
              <Link href="/register" className="btn btn-success btn-lg px-4"><i className="bi bi-person-plus" /> Create free account</Link>
              <Link href="/login" className="btn btn-outline-secondary btn-lg px-4">Sign in</Link>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card p-4" aria-hidden="true">
              <div className="d-flex align-items-center gap-4 flex-wrap justify-content-center">
                <CalorieRing consumed={1420} goal={2000} variant="eaten" />
                <div className="flex-grow-1" style={{ minWidth: 200 }}>
                  <MacroBar label="Protein" cls="bg-protein" value={96} target={150} />
                  <MacroBar label="Carbs" cls="bg-carbs" value={150} target={200} />
                  <MacroBar label="Fat" cls="bg-fat" value={44} target={67} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="row g-4 py-4">
        {features.map((f) => (
          <div className="col-md-6 col-lg-3" key={f.title}>
            <div className="card h-100 p-4">
              <div className={`feature-icon ${f.tone} mb-3`}><i className={`bi ${f.icon}`} /></div>
              <h2 className="h5">{f.title}</h2>
              <p className="text-body-secondary mb-0">{f.text}</p>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
