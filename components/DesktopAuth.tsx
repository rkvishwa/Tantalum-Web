'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { currentUser } from '@/lib/appwrite';
import { config } from '@/lib/config';
import { executeFunction } from '@/lib/functions';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Eyebrow } from '@/components/ui/Section';

type GrantResponse = {
  grantId: string;
  expiresAt: string;
  callbackUrl: string;
};

type AuthTarget = {
  eyebrow: string;
  title: string;
  checkingMessage: string;
  missingMessage: string;
  openingMessage: string;
  buttonLabel: string;
  defaultScheme: string;
};

const desktopTarget: AuthTarget = {
  eyebrow: 'Desktop login',
  title: 'Connect Tantalum IDE',
  checkingMessage: 'Checking your web session...',
  missingMessage: 'Desktop login request is missing required values. Start login again from Tantalum IDE.',
  openingMessage: 'Opening Tantalum IDE...',
  buttonLabel: 'Open Tantalum IDE',
  defaultScheme: config.desktopScheme,
};

const mobileTarget: AuthTarget = {
  eyebrow: 'Mobile login',
  title: 'Connect Tantalum Mobile',
  checkingMessage: 'Checking your web session...',
  missingMessage: 'Mobile login request is missing required values. Start login again from Tantalum Mobile.',
  openingMessage: 'Opening Tantalum Mobile...',
  buttonLabel: 'Open Tantalum Mobile',
  defaultScheme: config.mobileScheme,
};

function authReturn(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function AuthHandoffPage({ target, pathname }: { target: AuthTarget; pathname: '/auth/desktop' | '/auth/mobile' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(target.checkingMessage);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [variant, setVariant] = useState<'info' | 'success' | 'error' | 'warning'>('info');

  const query = useMemo(() => {
    const state = searchParams.get('state') || '';
    const codeChallenge = searchParams.get('challenge') || searchParams.get('codeChallenge') || '';
    const callbackScheme = searchParams.get('scheme') || target.defaultScheme;
    return { state, codeChallenge, callbackScheme };
  }, [searchParams, target.defaultScheme]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!query.state || !query.codeChallenge) {
        setMessage(target.missingMessage);
        setVariant('error');
        return;
      }

      const user = await currentUser();
      if (!user) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('authReturn', authReturn(pathname, searchParams));
        router.replace(`/login?${params.toString()}`);
        return;
      }

      if (!user.emailVerification) {
        setMessage('Verify your email address before signing in to the app.');
        setVariant('warning');
        return;
      }

      try {
        const grant = await executeFunction<GrantResponse>(config.desktopAuthFunctionId, '/grant', query);
        if (!mounted) return;
        setCallbackUrl(grant.callbackUrl);
        setMessage(target.openingMessage);
        setVariant('success');
        window.location.href = grant.callbackUrl;
      } catch (error) {
        if (!mounted) return;
        setMessage(error instanceof Error ? error.message : 'App login failed.');
        setVariant('error');
      }
    }

    void run();

    return () => {
      mounted = false;
    };
  }, [pathname, query, router, searchParams, target.missingMessage, target.openingMessage]);

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <BrandLogo />
          <Eyebrow>{target.eyebrow}</Eyebrow>
        </div>
        <h1>{target.title}</h1>
        <Banner variant={variant}>{message}</Banner>
        {callbackUrl ? (
          <div className="auth-actions">
            <Button variant="primary" size="md" href={callbackUrl}>{target.buttonLabel}</Button>
          </div>
        ) : null}
        <p style={{ marginTop: 16, fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: 'var(--accent)' }}>Go to dashboard</Link>
        </p>
      </div>
    </section>
  );
}

export function DesktopAuthPage() {
  return <AuthHandoffPage target={desktopTarget} pathname="/auth/desktop" />;
}

export function MobileAuthPage() {
  return <AuthHandoffPage target={mobileTarget} pathname="/auth/mobile" />;
}
