'use client';
// NFC tags (NTAG 424 DNA). A tap on the tag adds a stamp; every tap is signed by the tag and can be used once,
// so a photo or a saved link of a tap stamps nothing. The tag stays with the staff: without a purchase there is
// no tap. Tags are registered by Perko (scripts/admin.ts nfc:add); here the owner names, disables and enables them
// and decides whether a tap also needs the staff PIN.
import Link from 'next/link';
import { useState } from 'react';
import { useDashboard } from '../../../components/Dashboard';
import { Loading, useLoad } from '../../../components/useLoad';
import { fmtDate, fmtTime, getAlerts, getNfcTags, setNfcRequirePin, updateNfcTag, type NfcTag } from '../../../lib/api';

export default function NfcPage() {
  const { business, patch } = useDashboard();
  const { data, error, loading, reload } = useLoad(() => Promise.all([getNfcTags(business.id), getAlerts(business.id)]), [business.id]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: ok });
      await reload();
    } catch (e) {
      setMessage({ ok: false, text: `לא נשמר: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const setPin = (on: boolean) =>
    on !== business.nfcRequirePin &&
    act(async () => {
      await setNfcRequirePin(business.id, on);
      patch({ nfcRequirePin: on });
    }, on ? 'מעכשיו אחרי נגיעה בתג הצוות מקליד גם את הקוד.' : 'מעכשיו נגיעה בתג מוסיפה חותמת בלי קוד.');

  const toggle = (t: NfcTag) => {
    if (t.active && !window.confirm(`להשבית את ״${t.label ?? t.uid}״? נגיעות בו לא יוסיפו חותמות עד שתפעילו אותו שוב.`)) return;
    act(() => updateNfcTag(t.id, { active: !t.active }), t.active ? 'התג הושבת.' : 'התג פעיל שוב.');
  };
  const rename = (t: NfcTag) => {
    const label = window.prompt('שם לתג (למשל ״קופה ראשית״)', t.label ?? '');
    if (label === null) return;
    const v = label.trim().slice(0, 40) || null;
    act(() => updateNfcTag(t.id, { label: v }), 'השם נשמר.');
  };

  const tags = data?.[0];
  const nfcAlerts = (data?.[1] ?? []).filter((a) => a.kind.startsWith('nfc_')).slice(0, 5);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>תגי NFC</h1>
          <span className="muted">תג קטן שנשאר אצל הצוות. אחרי התשלום הלקוח נוגע בו עם הטלפון, והחותמת נוספת. כל נגיעה חתומה וטובה פעם אחת, כך שצילום או קישור שמור לא מוסיפים חותמת.</span>
        </div>
      </div>
      {message ? <p className={message.ok ? 'note' : 'note warn'} role={message.ok ? 'status' : 'alert'}>{message.text}</p> : null}

      <div className="panel">
        <h3>קוד צוות גם בנגיעה</h3>
        <div className="seg" role="group" aria-label="קוד צוות בנגיעה בתג">
          <button type="button" aria-pressed={!business.nfcRequirePin} onClick={() => setPin(false)} disabled={busy}>בלי קוד (מומלץ)</button>
          <button type="button" aria-pressed={business.nfcRequirePin} onClick={() => setPin(true)} disabled={busy}>גם קוד</button>
        </div>
        <p className="muted small">
          {business.nfcRequirePin
            ? 'אחרי הנגיעה הצוות מקליד את הקוד על הטלפון של הלקוח, כמו בסריקת הקוד שבקופה. איטי יותר, ומתאים אם התג נגיש ללקוחות.'
            : 'נגיעה בתג מוסיפה חותמת מיד. זה בטוח כל עוד התג אצל הצוות: מי שלא קנה לא מגיע אליו. סריקת הקוד שבקופה ממשיכה לדרוש קוד, וגם קבלת ההטבה.'}
        </p>
      </div>

      <div className="panel">
        <h3>התגים של העסק</h3>
        {loading && !data ? <Loading onRetry={reload} /> : error ? <Loading error={error} onRetry={reload} /> : null}
        {tags && tags.length === 0 ? (
          <p className="note">עוד אין תגים. כדי לקבל תג, כתבו לנו ל-hello@getperko.com ונגדיר אותו לעסק.</p>
        ) : null}
        {tags && tags.length > 0 ? (
          <ul className="list">
            {tags.map((t) => (
              <li key={t.id}>
                <div className="grow">
                  <strong>{t.label ?? 'תג בלי שם'}</strong>{' '}
                  {t.active ? <span className="tag lime">פעיל</span> : <span className="tag warn">מושבת</span>}
                  <div className="muted small">
                    {t.lastTapAt ? `נגיעה אחרונה ${fmtDate(t.lastTapAt)} ${fmtTime(t.lastTapAt)}` : 'עוד לא נגעו בו'}
                    {' · '}{t.taps7d} חותמות ב-7 ימים{t.rejected7d ? ` · ${t.rejected7d} נגיעות נדחו` : ''}
                  </div>
                  <div className="dim tiny num" dir="ltr" style={{ textAlign: 'end' }}>{t.uid}</div>
                </div>
                <div className="row">
                  <button type="button" className="btn quiet small" onClick={() => rename(t)} disabled={busy}>שינוי שם</button>
                  <button type="button" className={t.active ? 'btn quiet small' : 'btn small'} onClick={() => toggle(t)} disabled={busy}>{t.active ? 'השבתה' : 'הפעלה'}</button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="muted small">תג שאבד או נגנב: משביתים אותו כאן, ונגיעות בו לא יוסיפו חותמות.</p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>נגיעות חשודות</h3>
          <Link className="link" href="/alerts">כל ההתראות</Link>
        </div>
        {nfcAlerts.length === 0 ? (
          <p className="muted small">אין. כאן יופיעו קישורים ישנים שנפתחו שוב, חותמות מחוץ לשעות הפתיחה ונגיעות רבות בזמן קצר.</p>
        ) : (
          <ul className="list">
            {nfcAlerts.map((a) => (
              <li key={a.id}>
                <div className="grow">
                  <strong>
                    {a.kind === 'nfc_stale' ? 'קישור מנגיעה ישנה נפתח שוב ושוב' : a.kind === 'nfc_off_hours' ? 'חותמת כשהעסק סגור' : 'הרבה נגיעות בזמן קצר'}
                  </strong>
                  <div className="muted small">״{a.tagLabel ?? 'תג'}״{a.customer ? ` · ${a.customer}` : ''}</div>
                </div>
                <span className="muted small num">{fmtDate(a.createdAt)} {fmtTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
