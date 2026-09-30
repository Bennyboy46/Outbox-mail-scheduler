'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setAuthError(new URLSearchParams(window.location.search).get('error'));
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f3f3] px-4 py-10">
      <div className="w-full max-w-[440px] rounded-[18px] border-[2px] border-[#1da1f2] bg-[#f5f5f5] p-5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)] sm:p-6">
        <h1 className="mb-6 text-center text-[42px] font-semibold leading-none tracking-[-0.04em] text-[#1f2937]">
          Login
        </h1>

        {authError ? (
          <p className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            Google sign-in could not be completed. Check the OAuth configuration and try again.
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={status === 'loading'}
          className="flex w-full items-center justify-center gap-3 rounded-[10px] border border-[#1da1f2] bg-[#dff5eb] px-4 py-3 text-[20px] font-medium text-[#1f2937] shadow-sm transition hover:bg-[#d3f0e2] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.39a4.61 4.61 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.99-4.3 2.99-7.53Z" fill="#4285F4" />
            <path d="M12 23c2.7 0 4.96-.9 6.61-2.43l-3.24-2.5c-.9.6-2.07.96-3.37.96-2.6 0-4.8-1.76-5.58-4.12H.68v2.62A11 11 0 0 0 12 23Z" fill="#34A853" />
            <path d="M6.42 21.8a6.96 6.96 0 0 1 0-4.38V14.8H2.95a11.04 11.04 0 0 0 0 9.9l3.47-2.9Z" fill="#FBBC05" />
            <path d="M12 4.98c1.47 0 2.79.5 3.84 1.49l2.88-2.88A11 11 0 0 0 2.95 14.8H6.42A6.98 6.98 0 0 1 12 4.98Z" fill="#EA4335" />
          </svg>
          <span>Login with Google</span>
        </button>

      </div>
    </div>
  );
}
