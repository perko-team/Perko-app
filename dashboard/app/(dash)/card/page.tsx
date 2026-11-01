'use client';
// The card's look: background (a brand face or the owner's photo under a dark layer), logo and stamp shape,
// with a live preview drawn exactly as the app draws the wallet card. Saving updates every customer's card.
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { CARD_STYLE_LABELS, FACES, STAMP_GLYPHS, STAMP_SHAPE_LABELS, type CardStyle, type StampShape } from '../../../../src/cardLook.ts';
import { CardPreview } from '../../../components/CardPreview';
import { useDashboard } from '../../../components/Dashboard';
import { CheckIcon } from '../../../components/Icons';
import { Loading, useLoad } from '../../../components/useLoad';
import { getProgram, imageProblem, media, removeImages, saveLook, uploadImage, type LookSettings } from '../../../lib/api';

const STYLES: CardStyle[] = ['auto', 'lime', 'ink', 'paper', 'photo'];
const SHAPES: StampShape[] = ['circle', 'cup', 'heart', 'star'];
const SWATCH: Record<CardStyle, string> = { auto: '', lime: FACES[0].bg, ink: FACES[1].bg, paper: FACES[2].bg, photo: '#3B2A1E' };
type Tab = 'bg' | 'logo' | 'shape';

export default function CardPage() {
  const { business, patch } = useDashboard();
  const { data: program, error, loading, reload } = useLoad(() => getProgram(business.id), [business.id]);
  const [draft, setDraft] = useState<LookSettings>(business.look);
  const [tab, setTab] = useState<Tab>('bg');
  const [busy, setBusy] = useState<null | 'bg' | 'logo' | 'save'>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Files uploaded in this session but not saved yet: removed again if the owner cancels.
  const pending = useRef<string[]>([]);
  const bgInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- another business was chosen: start from its look
    setDraft(business.look);
  }, [business.id, business.look]);

  const set = (p: Partial<LookSettings>) => {
    setMessage(null);
    setDraft((d) => ({ ...d, ...p }));
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(business.look);

  const pick = async (kind: 'bg' | 'logo', e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) return setMessage({ ok: false, text: problem });
    setBusy(kind);
    setMessage(null);
    try {
      const path = await uploadImage(business.id, kind, file);
      pending.current.push(path);
      set(kind === 'bg' ? { imagePath: path, style: 'photo' } : { logoPath: path });
    } catch (err) {
      setMessage({ ok: false, text: `ההעלאה נכשלה: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    setMessage(null);
    try {
      await saveLook(business.id, draft);
      const before = business.look;
      // Files this save no longer uses: the old ones it replaced and uploads that were swapped again.
      const unused = [before.imagePath, before.logoPath, ...pending.current].filter((p) => p && p !== draft.imagePath && p !== draft.logoPath);
      pending.current = [];
      patch({ look: draft });
      removeImages(unused);
      setMessage({ ok: true, text: 'נשמר. הכרטיס התעדכן אצל כל הלקוחות.' });
    } catch (err) {
      setMessage({ ok: false, text: `לא נשמר: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const cancel = () => {
    removeImages(pending.current);
    pending.current = [];
    setDraft(business.look);
    setMessage(null);
  };

  const look = { style: draft.style, imageUrl: media(draft.imagePath), logoUrl: media(draft.logoPath), overlay: draft.overlay, stampShape: draft.stampShape };
  const chooseStyle = (s: CardStyle) => (s === 'photo' && !draft.imagePath ? bgInput.current?.click() : set({ style: s }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>עיצוב הכרטיס</h1>
          <span className="muted">השינויים מופיעים בארנק של כל הלקוחות ברגע שלוחצים שמירה.</span>
        </div>
        <div className="save-bar">
          <button type="button" className="btn quiet" onClick={cancel} disabled={!dirty || !!busy}>ביטול שינויים</button>
          <button type="button" className="btn" onClick={save} disabled={!dirty || !!busy}>{busy === 'save' ? 'שומרים…' : 'שמירה ופרסום'}</button>
        </div>
      </div>
      {message ? <p className={message.ok ? 'note' : 'note warn'} role={message.ok ? 'status' : 'alert'}>{message.text}</p> : null}

      <div className="split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="seg full only-narrow" role="tablist" aria-label="מה עורכים">
            {([['bg', 'רקע'], ['logo', 'לוגו'], ['shape', 'חותמת']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          <section className={`panel${tab === 'bg' ? '' : ' tab-hide'}`} aria-labelledby="bg-h">
            <h2 id="bg-h">רקע</h2>
            <div className="options five" role="radiogroup" aria-label="רקע הכרטיס">
              {STYLES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={draft.style === s} className="option" onClick={() => chooseStyle(s)}>
                  <span className="swatch" style={s === 'auto'
                    ? { background: `linear-gradient(90deg, ${FACES[0].bg} 0 33%, ${FACES[1].bg} 33% 66%, ${FACES[2].bg} 66%)` }
                    : s === 'photo' && draft.imagePath ? { backgroundImage: `url("${media(draft.imagePath)}")` } : { background: SWATCH[s] }} />
                  {s === 'auto' ? 'לפי Perko' : CARD_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
            {draft.style === 'auto' ? <p className="muted small">Perko בוחרת צבע קבוע מתוך צבעי המותג.</p> : null}
            {draft.style === 'photo' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                <div className="upload">
                  <span className="thumb" style={draft.imagePath ? { backgroundImage: `url("${media(draft.imagePath)}")` } : undefined} />
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <strong style={{ fontSize: 15 }}>תמונת הרקע</strong>
                    <span className="muted tiny">JPG, PNG או WEBP, עד 5MB. מומלץ ברוחב 1200 פיקסלים לפחות.</span>
                  </span>
                  <button type="button" className="btn quiet small" onClick={() => bgInput.current?.click()} disabled={!!busy}>
                    {busy === 'bg' ? 'מעלים…' : 'החלפה'}
                  </button>
                </div>
                <label className="field">
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>הכהיית התמונה<span className="muted num" style={{ fontWeight: 500 }}>{draft.overlay}%</span></span>
                  <input type="range" min={30} max={85} value={draft.overlay} onChange={(e) => set({ overlay: Number(e.target.value) })} />
                  <span className="hint">שכבה כהה מעל התמונה, כדי שהטקסט והחותמות ייקראו בכל תמונה.</span>
                </label>
              </div>
            ) : null}
            <input ref={bgInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick('bg', e)} />
          </section>

          <section className={`panel${tab === 'logo' ? '' : ' tab-hide'}`} aria-labelledby="logo-h">
            <h2 id="logo-h">לוגו</h2>
            <div className="upload">
              <span className="thumb round" style={draft.logoPath ? { backgroundImage: `url("${media(draft.logoPath)}")` } : undefined}>{draft.logoPath ? null : business.initial}</span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ fontSize: 15 }}>{draft.logoPath ? 'הלוגו שלכם' : 'בלי לוגו: מוצגת האות הראשונה'}</strong>
                <span className="muted tiny">ריבועי, PNG או WEBP עם רקע. מוצג בעיגול.</span>
              </span>
              <div className="row">
                {draft.logoPath ? <button type="button" className="btn quiet small" onClick={() => set({ logoPath: null })} disabled={!!busy}>הסרה</button> : null}
                <button type="button" className="btn quiet small" onClick={() => logoInput.current?.click()} disabled={!!busy}>
                  {busy === 'logo' ? 'מעלים…' : draft.logoPath ? 'החלפה' : 'העלאה'}
                </button>
              </div>
            </div>
            <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick('logo', e)} />
          </section>

          <section className={`panel${tab === 'shape' ? '' : ' tab-hide'}`} aria-labelledby="shape-h">
            <h2 id="shape-h">צורת החותמת</h2>
            <div className="options" role="radiogroup" aria-label="צורת החותמת">
              {SHAPES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={draft.stampShape === s} className="option shape" onClick={() => set({ stampShape: s })}>
                  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
                    {s === 'circle'
                      ? <circle cx="12" cy="12" r="6" fill="currentColor" />
                      : <path d={STAMP_GLYPHS[s]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  </svg>
                  {STAMP_SHAPE_LABELS[s]}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="stage-col">
          <div className="stage">
            <span className="muted tiny" style={{ fontWeight: 700, letterSpacing: '0.02em' }}>תצוגה חיה · כך הלקוחות רואים את הכרטיס</span>
            <div style={{ width: '100%', maxWidth: 440 }}>
              {program ? (
                <CardPreview
                  businessId={business.id} name={business.name} initial={business.initial} programName={program.name}
                  goal={program.goal} current={Math.max(1, Math.round(program.goal * 0.7))} reward={program.reward} look={look}
                />
              ) : <Loading error={loading ? undefined : error} onRetry={reload} />}
            </div>
            {draft.style === 'photo' ? (
              <span className="muted tiny" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <CheckIcon size={14} />הטקסט מוצג מעל שכבה כהה של {draft.overlay}%
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
