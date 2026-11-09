'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import { FieldError, FormAlert, SubmitButton, fieldClass } from '@/components/forms';

export function LoginForm({ returnUrl }: { returnUrl?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <>
      <div className="card p-4">
        <form action={action} noValidate>
          <FormAlert state={state} />
          <input type="hidden" name="returnUrl" value={returnUrl ?? ''} />
          <div className="form-floating mb-3">
            <input id="email" name="email" type="email" className={fieldClass(state, 'email')} autoComplete="username"
              placeholder="name@example.com" defaultValue={state?.values?.email ?? ''} autoFocus required />
            <label htmlFor="email">Email</label>
            <FieldError state={state} name="email" />
          </div>
          <div className="form-floating mb-3">
            <input id="password" name="password" type="password" className={fieldClass(state, 'password')} autoComplete="current-password" placeholder="Password" required />
            <label htmlFor="password">Password</label>
            <FieldError state={state} name="password" />
          </div>
          <SubmitButton className="btn btn-success w-100 py-2"><i className="bi bi-box-arrow-in-right" /> Sign in</SubmitButton>
        </form>
      </div>
      <p className="text-center mt-3 text-body-secondary">
        New here? <Link href={returnUrl ? `/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/register'}>Create an account</Link>
      </p>
    </>
  );
}
