'use client';
// "שחרור" on an active PIN lockout: after a confirmation that names the risk, the customer can collect again today.
import { useState } from 'react';
import { releaseLockout } from '../lib/api';

export const RELEASE_RISK = 'אם מישהו ניסה לנחש את הקוד, השחרור מאפשר לו לנסות שוב.';

export function ReleaseButton({ businessId, alertId, customer, onDone }: { businessId: string; alertId: string; customer: string | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const release = async () => {
    if (!window.confirm(`לשחרר את ${customer ?? 'הלקוח/ה'}? ${RELEASE_RISK}`)) return;
    setBusy(true);
    setError(null);
    try {
      await releaseLockout(businessId, alertId);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className="btn small" onClick={release} disabled={busy} aria-label={`שחרור הנעילה של ${customer ?? 'הלקוח/ה'}`}>
        {busy ? 'משחררים…' : 'שחרור'}
      </button>
      {error ? <span className="small" role="alert" style={{ color: 'var(--warn)' }}>{error}</span> : null}
    </span>
  );
}
