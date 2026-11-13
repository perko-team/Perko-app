'use client';
// On phones: the sections that are not in the tab bar, and signing out.
import Link from 'next/link';
import { useDashboard } from '../../../components/Dashboard';
import { BellIcon, ChevronIcon, ExitIcon, InfoIcon, ProgramIcon, QrIcon } from '../../../components/Icons';

const LINKS = [
  { href: '/program', label: 'תוכנית', hint: 'יעד, הטבה, כללים וזמן המתנה', Icon: ProgramIcon },
  { href: '/info', label: 'פרטי העסק', hint: 'שעות פתיחה, טלפון וכשרות', Icon: InfoIcon },
  { href: '/alerts', label: 'התראות', hint: 'קודי צוות שגויים וחסימות', Icon: BellIcon },
  { href: '/qr', label: 'קוד לקופה', hint: 'הורדה והדפסה', Icon: QrIcon },
];

export default function More() {
  const { signOut } = useDashboard();
  return (
    <div className="page">
      <div className="page-head"><div><h1>עוד</h1></div></div>
      <ul className="list">
        {LINKS.map(({ href, label, hint, Icon }) => (
          <li key={href} style={{ padding: 0 }}>
            <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', textDecoration: 'none', width: '100%' }}>
              <span className="avatar" style={{ background: 'var(--raised-2)', color: 'var(--text)' }}><Icon /></span>
              <span className="grow"><strong>{label}</strong><span className="muted tiny">{hint}</span></span>
              <ChevronIcon size={18} />
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className="btn quiet" onClick={signOut}><ExitIcon size={18} />יציאה</button>
    </div>
  );
}
