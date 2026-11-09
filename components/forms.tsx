'use client';

import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/validation';

/** Submit button that disables itself while its form's action is running. */
export function SubmitButton({ children, className = 'btn btn-success', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} aria-busy={pending} {...rest}>
      {pending && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function FieldError({ state, name }: { state: FormState | undefined; name: string }) {
  const errors = state?.fieldErrors?.[name];
  if (!errors?.length) return null;
  return <div className="text-danger small mt-1">{errors[0]}</div>;
}

export function FormAlert({ state }: { state: FormState | undefined }) {
  if (!state?.error) return null;
  return <div className="alert alert-danger py-2 small" role="alert">{state.error}</div>;
}

/** Classes for an input, adding is-invalid when the field has an error. */
export const fieldClass = (state: FormState | undefined, name: string, base = 'form-control') =>
  state?.fieldErrors?.[name]?.length ? `${base} is-invalid` : base;

/** A form that asks for confirmation before running a server action. */
export function ConfirmForm({ message, action, children, className }: {
  message: string;
  action: (fd: FormData) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form action={action} className={className} onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </form>
  );
}
