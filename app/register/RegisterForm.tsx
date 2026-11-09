'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { register } from '@/app/actions/auth';
import { FieldError, FormAlert, SubmitButton, fieldClass } from '@/components/forms';

export function RegisterForm({ returnUrl }: { returnUrl?: string }) {
  const [state, action] = useActionState(register, undefined);
  const [timeZone, setTimeZone] = useState('UTC');
  useEffect(() => {
    try { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); } catch { /* keep UTC */ }
  }, []);
  const v = state?.values;

  return (
    <>
      <div className="card p-4">
        <form action={action} noValidate>
          <FormAlert state={state} />
          <input type="hidden" name="returnUrl" value={returnUrl ?? ''} />
          <input type="hidden" name="timeZone" value={timeZone} />
          <div className="form-floating mb-3">
            <input id="displayName" name="displayName" className={fieldClass(state, 'displayName')} autoComplete="name"
              placeholder="Your name" defaultValue={v?.displayName ?? ''} maxLength={50} autoFocus required />
            <label htmlFor="displayName">Your name</label>
            <FieldError state={state} name="displayName" />
          </div>
          <div className="form-floating mb-3">
            <input id="email" name="email" type="email" className={fieldClass(state, 'email')} autoComplete="username"
              placeholder="name@example.com" defaultValue={v?.email ?? ''} required />
            <label htmlFor="email">Email</label>
            <FieldError state={state} name="email" />
          </div>
          <div className="form-floating mb-3">
            <input id="password" name="password" type="password" className={fieldClass(state, 'password')} autoComplete="new-password" placeholder="Password" required />
            <label htmlFor="password">Password</label>
            <FieldError state={state} name="password" />
            <div className="form-text">At least 8 characters, with an uppercase letter, a lowercase letter and a digit.</div>
          </div>
          <div className="form-floating mb-4">
            <input id="confirmPassword" name="confirmPassword" type="password" className={fieldClass(state, 'confirmPassword')} autoComplete="new-password" placeholder="Confirm password" required />
            <label htmlFor="confirmPassword">Confirm password</label>
            <FieldError state={state} name="confirmPassword" />
          </div>
          <SubmitButton className="btn btn-success w-100 py-2"><i className="bi bi-person-plus" /> Create account</SubmitButton>
        </form>
      </div>
      <p className="text-center mt-3 text-body-secondary">
        Already have an account? <Link href={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}>Sign in</Link>
      </p>
    </>
  );
}
