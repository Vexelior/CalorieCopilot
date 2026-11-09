'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSession, destroySession, purgeExpiredSessions } from '@/lib/auth';
import { isValidTimeZone } from '@/lib/dates';
import { setFlash } from '@/lib/flash';
import { hashPassword, passwordProblems, verifyPassword } from '@/lib/password';
import { createUser, findCredentialsByEmail, recordFailedLogin, resetFailedLogins } from '@/lib/users';
import { failure, formValues, type FormState } from '@/lib/validation';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;

const safeReturnUrl = (url: unknown) =>
  typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : '/diary';

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export async function login(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formValues(fd));
  if (!parsed.success) return failure(parsed.error, fd);

  const values = { email: parsed.data.email };
  const creds = await findCredentialsByEmail(parsed.data.email);
  if (creds?.lockoutEnd && Date.parse(creds.lockoutEnd) > Date.now()) {
    return { error: 'Too many failed attempts. Your account is locked for a few minutes.', values };
  }
  // Verify against a dummy hash when the user doesn't exist, so timing doesn't reveal registered emails.
  const ok = await verifyPassword(parsed.data.password, creds?.passwordHash ?? DUMMY_HASH);
  if (!creds || !ok) {
    if (creds) await recordFailedLogin(creds.id, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES);
    return { error: 'Invalid email or password.', values };
  }

  await resetFailedLogins(creds.id);
  await purgeExpiredSessions();
  await createSession(creds.id);
  redirect(safeReturnUrl(fd.get('returnUrl')));
}

const registerSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Your name is required.').max(50, 'Name must be at most 50 characters.'),
    email: z.email('Enter a valid email address.').max(254),
    password: z.string().max(100, 'Password must be at most 100 characters.'),
    confirmPassword: z.string(),
    timeZone: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const problems = passwordProblems(v.password);
    if (problems.length) ctx.addIssue({ code: 'custom', path: ['password'], message: `Password needs ${problems.join(', ')}.` });
    if (v.password !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'The passwords do not match.' });
  });

export async function register(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(formValues(fd));
  if (!parsed.success) return failure(parsed.error, fd);

  const { displayName, email, password, timeZone } = parsed.data;
  const id = await createUser({
    email,
    displayName,
    passwordHash: await hashPassword(password),
    timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC',
  });
  if (!id) return { error: `An account with ${email} already exists.`, values: { displayName, email } };

  await createSession(id);
  await setFlash('success', `Welcome, ${displayName}! Set up your goals on the Profile page for personalised targets.`);
  const returnUrl = fd.get('returnUrl');
  redirect(typeof returnUrl === 'string' && returnUrl ? safeReturnUrl(returnUrl) : '/profile');
}

export async function logout() {
  await destroySession();
  redirect('/');
}

// scrypt hash of a random password, used only to equalise timing for unknown emails.
const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
