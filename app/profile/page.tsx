import type { Metadata } from 'next';
import { applySuggestion } from '@/app/actions/profile';
import { logout } from '@/app/actions/auth';
import { SubmitButton } from '@/components/forms';
import { requireUser } from '@/lib/auth';
import { formatDate, todayIn } from '@/lib/dates';
import { n0 } from '@/lib/format';
import { suggestGoals } from '@/lib/goals';
import { AccountForm, BodyForm, DeleteAccountForm, PasswordForm, TargetsForm } from './ProfileForms';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await requireUser('/profile');
  const s = suggestGoals(user, todayIn(user.timeZone));
  const friendly = user.displayName?.trim() || user.email;
  const initials = friendly.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const timeZones = Intl.supportedValuesOf('timeZone');
  if (!timeZones.includes('UTC')) timeZones.unshift('UTC');

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <div className="rounded-circle avatar d-grid fw-bold fs-4" aria-hidden="true">{initials}</div>
        <div className="min-w-0">
          <h1 className="h3 mb-0 text-truncate">{friendly}</h1>
          <div className="text-body-secondary small text-truncate">{user.email} · Member since {formatDate(user.createdAt.slice(0, 10), { month: 'long', year: 'numeric' })}</div>
        </div>
        <form action={logout} className="ms-auto d-md-none">
          <button type="submit" className="btn btn-outline-secondary btn-sm"><i className="bi bi-box-arrow-right" /> Sign out</button>
        </form>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card mb-4" id="targets">
            <div className="card-header py-3 fw-semibold"><i className="bi bi-bullseye text-success" /> Daily targets</div>
            <div className="card-body">
              {s ? (
                <div className="alert border border-success-subtle bg-success-subtle d-flex flex-wrap align-items-center gap-3 py-2">
                  <i className="bi bi-magic fs-4 text-success" />
                  <div className="flex-grow-1 small">
                    <div className="fw-semibold">Suggested: {n0(s.calories)} kcal · P {s.proteinG} g · C {s.carbsG} g · F {s.fatG} g</div>
                    <div className="text-body-secondary">BMR {n0(s.bmr)} kcal · maintenance about {n0(s.tdee)} kcal (Mifflin-St Jeor)</div>
                  </div>
                  <form action={applySuggestion} data-action="apply-suggestion">
                    <SubmitButton className="btn btn-sm btn-success">Apply</SubmitButton>
                  </form>
                </div>
              ) : (
                <div className="alert alert-light border small py-2"><i className="bi bi-info-circle" /> Fill in your body details below to get personalised target suggestions.</div>
              )}
              <TargetsForm user={user} />
            </div>
          </div>

          <div className="card mb-4" id="body">
            <div className="card-header py-3 fw-semibold"><i className="bi bi-person-arms-up text-success" /> Body &amp; goal</div>
            <div className="card-body"><BodyForm user={user} /></div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card mb-4" id="account">
            <div className="card-header py-3 fw-semibold"><i className="bi bi-person-gear text-success" /> Account</div>
            <div className="card-body"><AccountForm user={user} timeZones={timeZones} /></div>
          </div>

          <div className="card mb-4" id="security">
            <div className="card-header py-3 fw-semibold"><i className="bi bi-shield-lock text-success" /> Change password</div>
            <div className="card-body"><PasswordForm /></div>
          </div>

          <div className="card border border-danger-subtle">
            <div className="card-header py-3 fw-semibold text-danger"><i className="bi bi-exclamation-octagon" /> Delete account</div>
            <div className="card-body">
              <p className="small text-body-secondary">Permanently deletes your account, diary, weigh-ins and saved products. This cannot be undone.</p>
              <DeleteAccountForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
