import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  if (await getCurrentUser()) redirect('/diary');
  const { returnUrl } = await searchParams;
  return (
    <div className="auth-card py-md-4">
      <div className="text-center mb-4">
        <img src="/img/logo.svg" alt="" className="brand-logo" width={64} height={64} />
        <h1 className="h3 mt-3 mb-1">Welcome back</h1>
        <p className="text-body-secondary">Sign in to continue tracking.</p>
      </div>
      <LoginForm returnUrl={typeof returnUrl === 'string' ? returnUrl : undefined} />
    </div>
  );
}
