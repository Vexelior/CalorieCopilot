import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  if (await getCurrentUser()) redirect('/diary');
  const { returnUrl } = await searchParams;
  return (
    <div className="auth-card py-md-4">
      <div className="text-center mb-4">
        <img src="/img/logo.svg" alt="" className="brand-logo" width={64} height={64} />
        <h1 className="h3 mt-3 mb-1">Create your account</h1>
        <p className="text-body-secondary">It takes less than a minute.</p>
      </div>
      <RegisterForm returnUrl={typeof returnUrl === 'string' ? returnUrl : undefined} />
    </div>
  );
}
