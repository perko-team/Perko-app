'use client';
// Overview: how the business is doing. The period's numbers against the period before, visits per day,
// when the regulars come, and the card with how many customers are close to a reward.
import Link from 'next/link';
import { useState } from 'react';
import { CardPreview } from '../../../components/CardPreview';
import { CountUp, Heatmap, heatSummary, VisitsChart } from '../../../components/Charts';
import { useDashboard } from '../../../components/Dashboard';
import { Loading, useLoad } from '../../../components/useLoad';
import { getDailyVisits, getHeatmap, getOverview, getProgram, media, type Overview } from '../../../lib/api';

const PERIODS = [7, 30, 90];

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false });

function greeting(): string {
  const h = Number(hourFmt.format(new Date()));
  if (h >= 5 && h < 12) return 'בוקר טוב';
  if (h >= 12 && h < 17) return 'צהריים טובים';
  if (h >= 17 && h < 22) return 'ערב טוב';
  return 'לילה טוב';
}

/** "▲ 12%" against the previous period, or nothing when there is nothing to compare with. */
function change(now: number, before: number): { text: string; dir: 'up' | 'down' | 'flat' } | null {
  if (before === 0) return now === 0 ? null : { text: 'חדש', dir: 'up' };
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: 'ללא שינוי', dir: 'flat' };
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, dir: pct > 0 ? 'up' : 'down' };
}

export default function OverviewPage() {
  const { business } = useDashboard();
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useLoad(
    () => Promise.all([getOverview(business.id, days), getDailyVisits(business.id, days), getHeatmap(business.id, Math.max(days, 30)), getProgram(business.id)]),
    [business.id, days],
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="muted small">{dateFmt.format(new Date())}</span>
          <h1>{greeting()}, {business.name}</h1>
        </div>
        <div className="seg" role="group" aria-label="תקופה">
          {PERIODS.map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>{d} ימים</button>)}
        </div>
      </div>

      {!data ? <Loading error={loading ? undefined : error} onRetry={reload} /> : <Body days={days} o={data[0]} daily={data[1]} heat={data[2]} program={data[3]} />}
    </div>
  );
}

function Body({ days, o, daily, heat, program }: {
  days: number;
  o: Overview;
  daily: { day: string; visits: number }[];
  heat: { dow: number; hour: number; visits: number }[];
  program: Awaited<ReturnType<typeof getProgram>>;
}) {
  const { business } = useDashboard();
  const share = (r: number, a: number) => (a ? Math.round((r / a) * 100) : 0);
  const retNow = share(o.returning, o.active);
  const retBefore = share(o.prevReturning, o.prevActive);
  const retDiff = retNow - retBefore;
  const kpis = [
    { label: 'ביקורים', value: o.visits, delta: change(o.visits, o.prevVisits), sub: 'מהתקופה הקודמת' },
    { label: 'לקוחות פעילים', value: o.active, delta: change(o.active, o.prevActive), sub: 'מהתקופה הקודמת' },
    {
      label: 'לקוחות חוזרים', value: retNow, suffix: '%', sub: 'ביקרו ביומיים שונים לפחות',
      delta: o.prevActive && retDiff !== 0 ? { text: `${retDiff > 0 ? '▲' : '▼'} ${Math.abs(retDiff)} נק׳`, dir: retDiff > 0 ? 'up' : 'down' } as const : null,
    },
    { label: 'הטבות שמומשו', value: o.redeemed, delta: change(o.redeemed, o.prevRedeemed), sub: 'מהתקופה הקודמת' },
  ];
  const look = { style: business.look.style, imageUrl: media(business.look.imagePath), logoUrl: media(business.look.logoPath), overlay: business.look.overlay, stampShape: business.look.stampShape };
  const empty = o.visits === 0 && o.prevVisits === 0;

  return (
    <>
      {empty ? (
        <p className="note">עוד אין ביקורים. אחרי החותמות הראשונות בקופה, הגרפים כאן יתמלאו. <Link className="link" href="/qr">להדפסת הקוד לקופה</Link></p>
      ) : null}
      <section className="grid cols-4" aria-label="מספרים עיקריים">
        {kpis.map((k, i) => (
          <div key={k.label} className="kpi rise" style={{ animationDelay: `${80 + i * 70}ms` }}>
            <span className="muted small">{k.label}</span>
            <b><CountUp value={k.value} suffix={k.suffix} /></b>
            <span className="delta">
              {k.delta ? <strong className={k.delta.dir === 'down' ? 'down' : k.delta.dir === 'up' ? 'up' : 'dim'}>{k.delta.text}</strong> : null}
              <span className="dim">{k.delta ? k.sub : k.label === 'לקוחות חוזרים' ? k.sub : 'אין עוד נתונים להשוואה'}</span>
            </span>
          </div>
        ))}
      </section>

      <section className="panel" aria-labelledby="visits-h">
        <div className="panel-head">
          <div>
            <h2 id="visits-h">ביקורים לפי יום</h2>
            <span className="muted small">ביקור הוא חותמת אחת שאושרה בקופה · {days} הימים האחרונים</span>
          </div>
        </div>
        <VisitsChart days={daily} />
      </section>

      <div className="grid cols-5">
        <section className="panel span-3" aria-labelledby="heat-h">
          <div className="panel-head">
            <div>
              <h2 id="heat-h">מתי הקבועים מגיעים</h2>
              <span className="muted small">{heatSummary(heat)}</span>
            </div>
          </div>
          <div className="only-wide"><Heatmap cells={heat} /></div>
          <div className="only-narrow"><Heatmap cells={heat} compact /></div>
        </section>

        <section className="panel span-2" aria-labelledby="card-h">
          <div className="panel-head">
            <h2 id="card-h">הכרטיס שלכם</h2>
            <Link className="link" href="/card">עריכה</Link>
          </div>
          {program ? (
            <CardPreview
              businessId={business.id} name={business.name} initial={business.initial} programName={program.name}
              goal={program.goal} current={Math.max(1, Math.round(program.goal * 0.7))} reward={program.reward} look={look}
            />
          ) : <p className="note">אין לעסק תוכנית פעילה.</p>}
          <dl className="facts" style={{ margin: 0 }}>
            <div><dt>כרטיסים פתוחים</dt><dd><CountUp value={o.openCards} /></dd></div>
            <div><dt>במרחק ביקור אחד מהטבה</dt><dd className="lime"><CountUp value={o.nearReward} /></dd></div>
            <div><dt>מלאים, מחכים למימוש</dt><dd><CountUp value={o.readyCards} /></dd></div>
          </dl>
        </section>
      </div>
    </>
  );
}
