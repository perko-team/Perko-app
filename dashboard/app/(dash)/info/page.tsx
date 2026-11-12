'use client';
// What customers see on the business page before walking in: opening hours per weekday (Friday included),
// a phone number they can tap, and an optional kashrut line. Empty fields are not shown in the app.
import { useEffect, useState, type FormEvent } from 'react';
import { DAY_NAMES, KASHRUT_MAX, telLink, type WeeklyHours } from '../../../../supabase/functions/_shared/hours.ts';
import { useDashboard } from '../../../components/Dashboard';
import { Loading, useLoad } from '../../../components/useLoad';
import { getBusinessInfo, saveBusinessInfo, type BusinessInfo } from '../../../lib/api';

const EMPTY_WEEK: WeeklyHours = [...Array(5).fill({ open: '09:00', close: '18:00' }), { open: '09:00', close: '14:00' }, null];

export default function InfoPage() {
  const { business } = useDashboard();
  const { data, error, loading, reload } = useLoad(() => getBusinessInfo(business.id), [business.id]);
  const [form, setForm] = useState<BusinessInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the form starts from the loaded info
    if (data) setForm(data);
  }, [data]);

  if (loading && !form) return <Loading onRetry={reload} />;
  if (error) return <Loading error={error} onRetry={reload} />;
  if (!form) return null;

  const week = form.weeklyHours;
  const setDay = (i: number, d: WeeklyHours[number]) => setForm({ ...form, weeklyHours: (week ?? EMPTY_WEEK).map((x, j) => (j === i ? d : x)) });
  const phoneBad = !!form.phone?.trim() && !telLink(form.phone);
  const timesBad = !!week?.some((d) => d && !(d.open && d.close));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (phoneBad || timesBad) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveBusinessInfo(business.id, form);
      setMessage({ ok: true, text: 'נשמר. דף העסק באפליקציה התעדכן.' });
      await reload();
    } catch (err) {
      setMessage({ ok: false, text: `לא נשמר: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="page" onSubmit={submit}>
      <div className="page-head">
        <div>
          <h1>פרטי העסק</h1>
          <span className="muted">מה שהלקוחות רואים בדף העסק באפליקציה. שדה ריק לא מוצג.</span>
        </div>
      </div>

      <div className="panel">
        <h3>שעות פתיחה</h3>
        {week ? (
          <>
            <p className="muted small">באפליקציה מוצגות השעות של היום, ואפשר לפתוח את כל השבוע.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DAY_NAMES.map((name, i) => {
                const d = week[i];
                return (
                  <div key={name} className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }} role="group" aria-label={`יום ${name}`}>
                    <strong style={{ width: 64 }}>{name}</strong>
                    <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={!d} onChange={(e) => setDay(i, e.target.checked ? null : { open: '09:00', close: '18:00' })} />
                      סגור
                    </label>
                    {d ? (
                      <>
                        <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                          <span className="muted small">פתיחה</span>
                          <input type="time" value={d.open} onChange={(e) => setDay(i, { ...d, open: e.target.value })} required />
                        </label>
                        <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                          <span className="muted small">סגירה</span>
                          <input type="time" value={d.close} onChange={(e) => setDay(i, { ...d, close: e.target.value })} required />
                        </label>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn quiet small" style={{ alignSelf: 'flex-start' }} onClick={() => setForm({ ...form, weeklyHours: null })}>
              הסרת השעות מהאפליקציה
            </button>
          </>
        ) : (
          <>
            <p className="muted small">עוד לא הוגדרו שעות. לקוחות שואלים בעיקר על שישי.</p>
            <button type="button" className="btn quiet small" style={{ alignSelf: 'flex-start' }} onClick={() => setForm({ ...form, weeklyHours: EMPTY_WEEK })}>
              הגדרת שעות לכל יום
            </button>
          </>
        )}
      </div>

      <div className="panel">
        <h3>טלפון וכשרות</h3>
        <label className="field">
          טלפון
          <span className="hint">הלקוחות יכולים ללחוץ ולהתקשר. למשל 02-6789012</span>
          <input type="tel" inputMode="tel" dir="ltr" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} aria-invalid={phoneBad} />
          {phoneBad ? <span className="hint" role="alert" style={{ color: 'var(--warn)' }}>זה לא נראה כמו מספר טלפון ישראלי</span> : null}
        </label>
        <label className="field">
          כשרות (לא חובה)
          <span className="hint">כפי שתרצו שיופיע. למשל: כשר, בהשגחת הרבנות ירושלים</span>
          <input value={form.kashrut ?? ''} onChange={(e) => setForm({ ...form, kashrut: e.target.value })} maxLength={KASHRUT_MAX} />
        </label>
      </div>

      {message ? <p className={message.ok ? 'note' : 'note warn'} role={message.ok ? 'status' : 'alert'}>{message.text}</p> : null}
      <div className="row">
        <button className="btn" disabled={saving || phoneBad || timesBad}>{saving ? 'שומרים…' : 'שמירה'}</button>
        <button type="button" className="btn quiet" onClick={() => { setForm(data ?? null); setMessage(null); }}>ביטול שינויים</button>
      </div>
    </form>
  );
}
