'use client';
// Every stamp and redemption, grouped by day, with who confirmed it. Customers appear by first name, the last 4
// digits of their phone or a masked email: never a full number or address. Exports to a CSV that Excel opens.
import { useMemo, useState } from 'react';
import { useDashboard } from '../../../components/Dashboard';
import { DownloadIcon } from '../../../components/Icons';
import { Loading, useLoad } from '../../../components/useLoad';
import { fmtDate, fmtTime, getLog, type LogRow } from '../../../lib/api';

const PERIODS = [7, 30, 90];
type Kind = 'all' | 'stamp' | 'redeem';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });
const dayName = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long' });

function dayLabel(iso: string): string {
  const k = dayKey.format(new Date(iso));
  const today = dayKey.format(new Date());
  const yesterday = dayKey.format(new Date(Date.now() - 86_400_000));
  if (k === today) return 'היום';
  if (k === yesterday) return 'אתמול';
  return dayName.format(new Date(iso));
}

function exportCsv(rows: LogRow[], name: string) {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [['תאריך', 'שעה', 'פעולה', 'פרט', 'אישר/ה', 'לקוח/ה'].map(cell).join(',')].concat(
    rows.map((r) => [fmtDate(r.createdAt), fmtTime(r.createdAt), r.kind === 'redeem' ? 'מימוש' : 'חותמת',
      r.kind === 'redeem' ? r.reward ?? '' : String(r.amount ?? ''), r.staffName, r.customer].map(cell).join(',')),
  );
  // A byte-order mark so Excel reads the Hebrew as UTF-8.
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `perko-${name}-${dayKey.format(new Date())}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function LogPage() {
  const { business } = useDashboard();
  const [days, setDays] = useState(7);
  const [kind, setKind] = useState<Kind>('all');
  const [staff, setStaff] = useState('');
  const { data, error, loading, reload } = useLoad(() => getLog(business.id, days), [business.id, days]);

  const staffNames = useMemo(() => [...new Set((data ?? []).map((r) => r.staffName))].sort((a, b) => a.localeCompare(b, 'he')), [data]);
  const rows = (data ?? []).filter((r) => (kind === 'all' || r.kind === kind) && (!staff || r.staffName === staff));
  const groups: { label: string; rows: LogRow[] }[] = [];
  for (const r of rows) {
    const label = dayLabel(r.createdAt);
    if (groups.at(-1)?.label !== label) groups.push({ label, rows: [] });
    groups.at(-1)!.rows.push(r);
  }
  const redeemed = rows.filter((r) => r.kind === 'redeem').length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>יומן</h1>
          <span className="muted">כל חותמת וכל מימוש, מי אישר ומתי. השעות לפי שעון ישראל.</span>
        </div>
        <button type="button" className="btn quiet" onClick={() => exportCsv(rows, business.slug)} disabled={!rows.length}>
          <DownloadIcon size={18} />ייצוא ל-Excel
        </button>
      </div>

      <div className="row">
        <div className="seg" role="group" aria-label="סוג פעולה">
          {([['all', 'הכל'], ['stamp', 'חותמות'], ['redeem', 'מימושים']] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
        <label className="row" style={{ gap: 8 }}>
          <span className="muted small">אישר/ה</span>
          <select value={staff} onChange={(e) => setStaff(e.target.value)} style={{ width: 'auto', minHeight: 40, padding: '6px 12px' }}>
            <option value="">כל הצוות</option>
            {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="row" style={{ gap: 8 }}>
          <span className="muted small">תקופה</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto', minHeight: 40, padding: '6px 12px' }}>
            {PERIODS.map((d) => <option key={d} value={d}>{d} ימים</option>)}
          </select>
        </label>
        {data ? <span className="muted small" style={{ marginInlineStart: 'auto' }}>{rows.length} פעולות · {redeemed} מימושים{data.length >= 500 ? ' · 500 האחרונות' : ''}</span> : null}
      </div>

      {!data ? <Loading error={loading ? undefined : error} onRetry={reload} /> : null}
      {data && rows.length === 0 ? <p className="note">אין פעולות בתקופה הזו.</p> : null}

      {rows.length ? (
        <>
          <div className="table-wrap only-wide">
            <table className="table">
              <thead>
                <tr><th scope="col" style={{ width: 90 }}>שעה</th><th scope="col">פעולה</th><th scope="col">אישר/ה</th><th scope="col">לקוח/ה</th></tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.label}>
                  <tr><th scope="rowgroup" colSpan={4} className="group">{g.label} <span className="dim" style={{ fontWeight: 500 }}>· {g.rows.length}</span></th></tr>
                  {g.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="num muted">{fmtTime(r.createdAt)}</td>
                      <td>
                        <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                          {r.kind === 'redeem' ? <span className="tag lime">מימוש</span> : <span className="tag">חותמת</span>}
                          <span style={{ fontWeight: 600 }}>{r.kind === 'redeem' ? r.reward : r.amount === 1 ? 'חותמת אחת' : `+${r.amount}`}</span>
                        </span>
                      </td>
                      <td>{r.staffName}</td>
                      <td><bdi>{r.customer}</bdi></td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <div className="only-narrow">
            {groups.map((g) => (
              <section key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <h2 className="muted small" style={{ margin: '6px 4px 0', fontSize: 14 }}>{g.label} · {g.rows.length}</h2>
                <ul className="list">
                  {g.rows.map((r, i) => (
                    <li key={i} style={{ flexWrap: 'nowrap' }}>
                      <span className={r.kind === 'redeem' ? 'tag lime' : 'tag'}>{r.kind === 'redeem' ? 'מימוש' : 'חותמת'}</span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <strong><bdi>{r.customer}</bdi></strong>
                        <span className="muted tiny">{r.kind === 'redeem' ? r.reward : r.amount === 1 ? 'חותמת אחת' : `+${r.amount}`} · {r.staffName}</span>
                      </span>
                      <span className="dim tiny num">{fmtTime(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
