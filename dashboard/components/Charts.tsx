'use client';
// The overview's charts: visits per day (bars, today in lime, a dashed average line) and the week by hour.
import { useEffect, useRef, useState } from 'react';

const dayFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' });
const longFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

export function VisitsChart({ days }: { days: { day: string; visits: number }[] }) {
  const max = Math.max(4, ...days.map((d) => d.visits));
  const avg = days.length ? days.reduce((s, d) => s + d.visits, 0) / days.length : 0;
  const ticks = [0, Math.floor(days.length / 3), Math.floor((2 * days.length) / 3), days.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const label = (iso: string) => dayFmt.format(new Date(iso + 'T12:00:00'));
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="bars" role="img" aria-label={`ביקורים לפי יום, ${days.length} ימים, ממוצע ${avg.toFixed(1)} ביום`}>
        <div className="avg" style={{ bottom: `${(avg / max) * 100}%` }} />
        {days.map((d, i) => (
          <div className="col" key={d.day} title={`${longFmt.format(new Date(d.day + 'T12:00:00'))}: ${d.visits} ביקורים`}>
            <div className={`bar${i === days.length - 1 ? ' today' : ''}`} style={{ height: `${(d.visits / max) * 100}%`, animationDelay: `${i * 14}ms` }} />
          </div>
        ))}
      </div>
      <div className="axis">
        {ticks.map((i) => <span key={i}>{i === days.length - 1 ? 'היום' : label(days[i].day)}</span>)}
      </div>
      <figcaption className="legend">
        <span><i style={{ background: 'var(--lime)' }} />היום</span>
        <span><i style={{ background: '#4a5040' }} />ימים קודמים</span>
        <span><i style={{ width: 14, height: 0, borderTop: '2px dashed var(--dim)', borderRadius: 0 }} />ממוצע {avg.toFixed(avg < 10 ? 1 : 0)}</span>
      </figcaption>
    </figure>
  );
}

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const SHADES = ['#23271E', 'rgba(215, 255, 53, 0.22)', 'rgba(215, 255, 53, 0.45)', 'rgba(215, 255, 53, 0.72)', '#D7FF35'];

/** Visits by weekday and hour. Only the hours and days that had any visit are drawn (a closed Saturday drops out). */
export function Heatmap({ cells, compact }: { cells: { dow: number; hour: number; visits: number }[]; compact?: boolean }) {
  const by = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.visits]));
  const hoursWith = cells.filter((c) => c.visits > 0).map((c) => c.hour);
  const from = Math.min(7, ...hoursWith);
  const to = Math.max(21, ...hoursWith);
  let hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (compact) hours = hours.filter((h) => (h - from) % 2 === 0);
  const days = DAYS.map((d, i) => i).filter((i) => i !== 6 || cells.some((c) => c.dow === 6 && c.visits > 0));
  const max = Math.max(1, ...cells.map((c) => c.visits));
  const value = (dow: number, h: number) => (compact ? (by.get(`${dow}-${h}`) ?? 0) + (by.get(`${dow}-${h + 1}`) ?? 0) : by.get(`${dow}-${h}`) ?? 0);
  const shade = (v: number) => (v === 0 ? SHADES[0] : SHADES[Math.min(4, 1 + Math.floor((v / max) * 3.999))]);
  return (
    <div className="heat" style={{ gridTemplateColumns: `${compact ? 26 : 44}px repeat(${hours.length}, minmax(0, 1fr))` }} role="img"
      aria-label="ביקורים לפי יום בשבוע ושעה">
      <span />
      {hours.map((h) => <span key={h} className="h">{h}</span>)}
      {days.map((d) => [
        <span key={`d${d}`} className="d">{DAYS[d]}</span>,
        ...hours.map((h) => {
          const v = value(d, h);
          return <span key={`${d}-${h}`} className="cell" style={{ background: shade(v) }} title={`${DAY_NAMES[d]} ${h}:00: ${v} ביקורים`} />;
        }),
      ])}
    </div>
  );
}

/** The busiest and quietest open hour, as a sentence. */
export function heatSummary(cells: { dow: number; hour: number; visits: number }[]): string {
  const open = cells.filter((c) => c.visits > 0);
  if (open.length < 3) return 'עוד אין מספיק ביקורים כדי לראות דפוס.';
  const top = open.reduce((a, b) => (b.visits > a.visits ? b : a));
  const low = open.reduce((a, b) => (b.visits < a.visits ? b : a));
  return `השעה העמוסה: ${DAY_NAMES[top.dow]} ${top.hour}:00 · השקטה: ${DAY_NAMES[low.dow]} ${low.hour}:00`;
}

/** A number that counts up once when it first appears. */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no animation: show the value as it is
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
      else done.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString('he-IL')}{suffix}</>;
}
