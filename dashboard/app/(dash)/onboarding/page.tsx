'use client';
// First run: three steps a new owner goes through once, then the overview. Check the program, create the team
// PIN (shown once), print the counter code. "דילוג" ends it too; the steps stay available in the menu.
import { TeamCodeNotes } from '../../../components/TeamCodeNotes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CounterCode } from '../../../../supabase/functions/_shared/api-types.ts';
import { CardPreview } from '../../../components/CardPreview';
import { useDashboard } from '../../../components/Dashboard';
import { Loading, useLoad } from '../../../components/useLoad';
import { businessAdmin, getProgram, listStaff, markOnboarded, media } from '../../../lib/api';
import { downloadPdf, previewDataUrl } from '../../../lib/counterDownload';

const STEPS = ['התוכנית', 'קוד לצוות', 'קוד לקופה'];

export default function Onboarding() {
  const { business, patch } = useDashboard();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const program = useLoad(() => getProgram(business.id), [business.id]);
  const staff = useLoad(() => listStaff(business.id), [business.id]);
  const [code, setCode] = useState<CounterCode | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    try {
      await markOnboarded(business.id);
      patch({ onboardedAt: new Date().toISOString() });
      router.replace('/overview');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const makePin = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await businessAdmin({ action: 'team_pin', businessId: business.id });
      if (r.status === 'pin') setPin(r.pin);
      else setError('לא הצלחנו ליצור קוד. אפשר לנסות שוב או ליצור אותו אחר כך בעמוד ״צוות״.');
      staff.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const getCode = async (): Promise<CounterCode | null> => {
    if (code) return code;
    let r = await businessAdmin({ action: 'qr_list', businessId: business.id });
    if (r.status === 'qr' && r.codes.length === 0) r = await businessAdmin({ action: 'qr_create', businessId: business.id, label: 'kupa' });
    const c = r.status === 'qr' ? r.codes[0] ?? null : null;
    setCode(c);
    return c;
  };
  // Step 3 shows the business's real counter code (creating one if it has none).
  useEffect(() => {
    if (step !== 3 || preview) return;
    let live = true;
    getCode()
      .then((c) => (c ? previewDataUrl(c.payload, 400) : null))
      .then((url) => live && setPreview(url))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when step 3 opens
  }, [step]);

  const print = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await getCode();
      if (!c) throw new Error('לא נמצא קוד לקופה');
      await downloadPdf(c, business.name);
    } catch (e) {
      setError(`ההורדה נכשלה: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const look = { style: business.look.style, imageUrl: media(business.look.imagePath), logoUrl: media(business.look.logoPath), overlay: business.look.overlay, stampShape: business.look.stampShape };
  const hasTeamPin = (staff.data?.length ?? 0) > 0;

  return (
    <div className="page" style={{ maxWidth: 1040, margin: '0 auto', gap: 36 }}>
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <span className="wordmark">perk<i /></span>
        <button type="button" className="link" style={{ color: 'var(--muted)' }} onClick={finish} disabled={busy}>דילוג</button>
      </header>

      <ol className="steps" aria-label="שלבים">
        {STEPS.map((label, i) => (
          <li key={label} className={i + 1 < step ? 'done' : undefined} aria-current={i + 1 === step ? 'step' : undefined}>
            <i /><span>{i + 1}. {label}</span>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">שלב {step} מתוך 3: {STEPS[step - 1]}</p>
      {error ? <p className="note warn" role="alert">{error}</p> : null}

      {step === 1 ? (
        <section className="split rise" style={{ alignItems: 'center', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h1 style={{ fontSize: 48 }}>ברוכים הבאים, {business.name}</h1>
            <p className="muted" style={{ fontSize: 18 }}>זו התוכנית שהגדרנו יחד. בדקו שהכל נכון: אפשר לשנות כל פרט עכשיו או בכל זמן מאוחר יותר.</p>
            {program.data ? (
              <dl className="facts" style={{ margin: 0, maxWidth: 420 }}>
                <div><dt>צבירה</dt><dd style={{ fontWeight: 600 }}>{program.data.rule}</dd></div>
                <div><dt>הטבה</dt><dd style={{ fontWeight: 600 }}>{program.data.reward}, אחרי {program.data.goal} {program.data.type === 'points' ? 'נקודות' : 'חותמות'}</dd></div>
                <div><dt>מימוש</dt><dd style={{ fontWeight: 600 }}>{program.data.redeemRule}</dd></div>
              </dl>
            ) : <Loading error={program.loading ? undefined : program.error} onRetry={program.reload} />}
            <div className="row" style={{ paddingTop: 8 }}>
              <button type="button" className="btn big" onClick={() => setStep(2)}>נראה טוב, ממשיכים</button>
              <Link className="btn quiet big" href="/program">עריכת התוכנית</Link>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 420, transform: 'rotate(-4deg)' }}>
              {program.data ? (
                <CardPreview businessId={business.id} name={business.name} initial={business.initial} programName={program.data.name}
                  goal={program.data.goal} current={0} reward={program.data.reward} look={look} />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="split rise" style={{ alignItems: 'center', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h1 style={{ fontSize: 48 }}>קוד לצוות</h1>
            <p className="muted" style={{ fontSize: 18 }}>אחרי שהלקוח סורק, מישהו מהצוות מקליד את הקוד הזה על הטלפון של הלקוח. ככה צילום של הקוד בקופה לא מספיק כדי לצבור מהבית.</p>
            <p className="dim">בהמשך אפשר לעבור לקוד אישי לכל עובד, בעמוד ״צוות״.</p>
            <TeamCodeNotes />
            <div className="row" style={{ paddingTop: 8 }}>
              {pin || (hasTeamPin && business.pinMode === 'shared') || business.pinMode === 'per_staff' ? (
                <button type="button" className="btn big" onClick={() => setStep(3)}>{pin ? 'רשמתי, ממשיכים' : 'ממשיכים'}</button>
              ) : (
                <button type="button" className="btn big" onClick={makePin} disabled={busy}>{busy ? 'יוצרים…' : 'יצירת קוד צוות'}</button>
              )}
              <button type="button" className="btn quiet big" onClick={() => setStep(1)}>חזרה</button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="panel" style={{ width: '100%', maxWidth: 420, alignItems: 'center', padding: '36px 28px', gap: 20 }}>
              <span className="muted small" style={{ fontWeight: 700 }}>קוד הצוות</span>
              <div className="digits" aria-label={pin ? `קוד הצוות: ${pin.split('').join(' ')}` : 'עוד לא נוצר קוד'}>
                {(pin ?? '    ').split('').map((d, i) => <span key={i} className={pin ? undefined : 'empty'}>{d.trim()}</span>)}
              </div>
              <span className="muted tiny" style={{ textAlign: 'center', maxWidth: 300 }}>
                {pin
                  ? 'הקוד מוצג פעם אחת בלבד. מעבירים אותו לצוות בעל פה, לא בצילום מסך.'
                  : hasTeamPin && business.pinMode === 'shared'
                    ? 'לעסק כבר יש קוד צוות פעיל. אפשר להחליף אותו בעמוד ״צוות״.'
                    : business.pinMode === 'per_staff'
                      ? 'העסק עובד עם קוד לכל עובד. מוסיפים עובדים בעמוד ״צוות״.'
                      : 'הקוד נוצר אקראית, ולא יהיה קוד קל לניחוש כמו 1234.'}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="split rise" style={{ alignItems: 'center', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h1 style={{ fontSize: 48 }}>קוד לקופה</h1>
            <p className="muted" style={{ fontSize: 18 }}>מדפיסים בגודל מקורי (100%) ומניחים ליד הקופה, במקום שהלקוחות רואים. זה הכל, אתם מוכנים.</p>
            <div className="row" style={{ paddingTop: 8 }}>
              <button type="button" className="btn big" onClick={print} disabled={busy}>{busy ? 'מכינים…' : 'הורדה להדפסה (PDF)'}</button>
              <button type="button" className="btn quiet big" onClick={finish} disabled={busy}>סיום, לסקירה</button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 240, aspectRatio: '105 / 148', background: 'var(--lime)', color: 'var(--ink)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, transform: 'rotate(3deg)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
              <span className="wordmark" style={{ color: 'var(--ink)', fontSize: 20, alignSelf: 'flex-start' }}>perk<i style={{ background: 'var(--ink)' }} /></span>
              <strong style={{ fontSize: 18 }}>{business.name}</strong>
              <span style={{ fontSize: 11 }}>סורקים כאן אחרי רכישה מזכה</span>
              <span style={{ flex: 1, background: '#fff', borderRadius: 8, display: 'grid', placeItems: 'center', padding: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL */}
                {preview ? <img src={preview} alt={`הקוד לקופה של ${business.name}`} style={{ width: '100%', height: 'auto' }} /> : <span className="dim tiny">טוענים…</span>}
              </span>
              <span style={{ fontSize: 9 }}>אחרי הסריקה, הצוות מאשר בקוד על הטלפון.</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
