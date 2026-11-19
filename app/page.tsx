import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalorieRing, MacroBar } from '@/components/CalorieRing';
import { getCurrentUser } from '@/lib/auth';

/** Proportional bar/space widths for the decorative barcode (bar, space, bar, space, ...). */
const BARCODE = [2, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 3, 1, 1, 4, 1, 1, 2, 2, 1, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 1, 2, 4, 1, 2, 1, 1, 3, 1, 2, 2, 1, 1, 1, 3];
const WEEK = [62, 78, 70, 88, 66, 94, 74];

export default async function HomePage() {
  if (await getCurrentUser()) redirect('/diary');

  return (
    <div className="landing">
      <section className="hero">
        <span className="eyebrow reveal">Calorie tracking, simplified</span>
        <h1 className="display-hero mt-3 reveal reveal-2">
          Eat well.<br /><span className="accent">Track less.</span>
        </h1>
        <p className="lead mb-4 reveal reveal-3">
          Log meals in seconds, scan barcodes with your camera, and see how your habits trend. Free and private.
        </p>
        <div className="d-flex justify-content-center flex-wrap gap-2 reveal reveal-3">
          <Link href="/register" className="btn btn-success btn-lg">Get started</Link>
          <Link href="/login" className="btn btn-outline-success btn-lg">Sign in</Link>
        </div>

        <div className="showcase reveal reveal-4" aria-hidden="true">
          <div className="row align-items-center g-4 g-lg-5 text-start">
            <div className="col-md-6 d-flex justify-content-center">
              <CalorieRing consumed={1420} goal={2000} variant="eaten" />
            </div>
            <div className="col-md-6">
              <span className="eyebrow">Today</span>
              <div className="d-flex gap-4 my-3">
                <div><div className="fs-2 fw-bolder tabular" style={{ letterSpacing: '-.04em' }}>580</div><div className="small text-body-secondary">kcal left</div></div>
                <div><div className="fs-2 fw-bolder tabular" style={{ letterSpacing: '-.04em' }}>4</div><div className="small text-body-secondary">meals logged</div></div>
              </div>
              <MacroBar label="Protein" cls="bg-protein" value={96} target={150} />
              <MacroBar label="Carbs" cls="bg-carbs" value={150} target={200} />
              <MacroBar label="Fat" cls="bg-fat" value={44} target={67} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="text-center mb-4 mb-md-5">
          <span className="eyebrow">Everything you need</span>
          <h2 className="section-title mt-3">Built for the way you eat.</h2>
        </div>
        <div className="bento">
          <article className="tile tile-dark span-4">
            <span className="eyebrow mb-2">Barcode scanning</span>
            <h3>Scan it. Log it. Done.</h3>
            <p>Point your camera at a package and its nutrition facts fill in from Open Food Facts. No typing required.</p>
            <div className="tile-visual" aria-hidden="true">
              <div className="barcode-art">
                {BARCODE.map((w, i) => <i key={i} style={{ flex: w, background: i % 2 ? 'transparent' : undefined }} />)}
              </div>
            </div>
          </article>
          <article className="tile span-2">
            <span className="eyebrow mb-2">Daily diary</span>
            <h3>Your day at a glance.</h3>
            <p>Breakfast to snacks, against your goal.</p>
            <div className="tile-visual d-flex justify-content-center" aria-hidden="true">
              <CalorieRing consumed={1720} goal={2000} />
            </div>
          </article>
          <article className="tile span-3">
            <span className="eyebrow mb-2">Analytics</span>
            <h3>See the trend, not just the day.</h3>
            <p>Calories, macros, meals and weight over 7, 30 or 90 days.</p>
            <div className="tile-visual" aria-hidden="true">
              <div className="mini-bars">
                {WEEK.map((h, i) => <span key={i} className={i === WEEK.length - 1 ? 'muted' : undefined} style={{ height: `${h}%` }} />)}
              </div>
            </div>
          </article>
          <article className="tile tile-accent span-3">
            <span className="eyebrow mb-2">Personal goals</span>
            <h3>Targets that fit you.</h3>
            <p>Suggested from your body stats and activity level, or set your own.</p>
            <div className="tile-visual" aria-hidden="true">
              <div className="display-hero mb-0 tabular" style={{ fontSize: 'clamp(3rem, 7vw, 4.5rem)' }}>2,240</div>
              <div className="eyebrow">kcal per day</div>
            </div>
          </article>
        </div>
      </section>

      <section className="statement">
        <h2 className="section-title">Every bite. Accounted for.</h2>
        <p className="lead mt-3 mb-4">Start in under a minute. No subscriptions, no ads.</p>
        <Link href="/register" className="btn btn-success btn-lg">Create your free account</Link>
      </section>
    </div>
  );
}
