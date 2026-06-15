'use client';

import { useState } from 'react';
import { LoaderCircle, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { account } from '@/lib/appwrite';
import { usePortalData } from '@/lib/portalData';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/Section';

function time(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function sessionActivityAt(session: { $createdAt: string } & Record<string, unknown>) {
  return typeof session.$updatedAt === 'string' ? session.$updatedAt : session.$createdAt;
}

export function AccountPanel() {
  const { user, sessions, errors, loading, refreshSessions } = usePortalData();
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [busySession, setBusySession] = useState('');

  async function sendVerification() {
    setMessage('');
    setIsSuccess(false);
    try {
      await account.createVerification(`${window.location.origin}/verify`);
      setMessage('Verification email sent.');
      setIsSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send verification email.');
    }
  }

  async function revokeSession(sessionId: string) {
    setBusySession(sessionId);
    setMessage('');
    setIsSuccess(false);
    try {
      await account.deleteSession(sessionId);
      setMessage('Session revoked.');
      setIsSuccess(true);
      await refreshSessions({ force: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to revoke session.');
    } finally {
      setBusySession('');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={user.name || user.email}
        actions={
          <Button variant="secondary" type="button" onClick={() => void refreshSessions({ force: true })}>
            {loading.sessions ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />} Sessions
          </Button>
        }
      />
      {message ? <Banner variant={isSuccess ? 'success' : 'error'}>{message}</Banner> : null}
      {errors.sessions ? <Banner variant="error">{errors.sessions}</Banner> : null}
      <div className="section-grid">
        <Card title="Email"><p>{user.email}</p></Card>
        <Card title="Email verified"><p>{user.emailVerification ? 'Yes' : 'No'}</p></Card>
        <Card title="Labels"><p>{(user.labels || []).join(', ') || 'User'}</p></Card>
      </div>
      {!user.emailVerification ? (
        <div className="hero-actions">
          <Button variant="primary" type="button" onClick={() => void sendVerification()}>
            <ShieldCheck size={14} /> Send verification email
          </Button>
        </div>
      ) : null}
      <section className="settings-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Logged in sessions</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Device</th><th>IP</th><th>Provider</th><th>Last active</th><th>Expires</th><th /></tr></thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.$id}>
                  <td>{session.deviceName || session.clientName || 'Unknown'}<br /><span className="muted">{session.osName || session.clientType || '-'}</span></td>
                  <td><code>{session.ip || '-'}</code></td>
                  <td>{session.provider || '-'}</td>
                  <td>{time(sessionActivityAt(session))}</td>
                  <td>{time(session.expire)}</td>
                  <td>
                    <Button variant="ghost" type="button" onClick={() => void revokeSession(session.$id)} disabled={busySession === session.$id || session.current}>
                      <Trash2 size={14} /> {session.current ? 'Current' : 'Revoke'}
                    </Button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 ? <tr><td colSpan={6}>No sessions found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
