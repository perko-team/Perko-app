'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { DashboardProvider, useDashboard } from '../../components/Dashboard';
import { BellIcon, CardIcon, ExitIcon, InfoIcon, LogIcon, MoreIcon, OverviewIcon, ProgramIcon, QrIcon, TeamIcon } from '../../components/Icons';
import { getAlerts, media } from '../../lib/api';

const SECTIONS = [
  { href: '/overview', label: 'סקירה', Icon: OverviewIcon },
  { href: '/card', label: 'הכרטיס', Icon: CardIcon },
  { href: '/program', label: 'תוכנית', Icon: ProgramIcon },
  { href: '/info', label: 'פרטי העסק', Icon: InfoIcon },
  { href: '/team', label: 'צוות', Icon: TeamIcon },
  { href: '/log', label: 'יומן', Icon: LogIcon },
  { href: '/alerts', label: 'התראות', Icon: BellIcon },
  { href: '/qr', label: 'קוד לקופה', Icon: QrIcon },
];
// The phone's tab bar: the four most used, the rest under "עוד".
const TABS = [
  { href: '/overview', label: 'סקירה', Icon: OverviewIcon },
  { href: '/card', label: 'כרטיס', Icon: CardIcon },
  { href: '/log', label: 'יומן', Icon: LogIcon },
  { href: '/team', label: 'צוות', Icon: TeamIcon },
  { href: '/more', label: 'עוד', Icon: MoreIcon },
];

export default function DashLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <Shell>{children}</Shell>
    </DashboardProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { businesses, business, choose, signOut } = useDashboard();
  const path = usePathname();
  const [unseen, setUnseen] = useState(0);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getAlerts(business.id).then((a) => live && setUnseen(a.filter((x) => !x.seenAt).length)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [business.id, path]);

  useEffect(() => {
    import('../../lib/supabase').then(({ sb }) => sb().auth.getUser()).then(({ data }) => setEmail(data.user?.email ?? null)).catch(() => undefined);
  }, []);

  // The first-run guide is a page of its own, without the menus.
  if (path === '/onboarding') return <main className="content"><div className="content-inner">{children}</div></main>;

  const logo = media(business.look.logoPath);
  const Biz = (
    <label className="biz">
      <span className="avatar">
        {/* eslint-disable-next-line @next/next/no-img-element -- a user-uploaded file from Supabase Storage */}
        {logo ? <img src={logo} alt="" /> : business.initial}
      </span>
      {businesses.length > 1 ? (
        <select aria-label="העסק" value={business.id} onChange={(e) => choose(e.target.value)}>
          {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      ) : (
        <span style={{ fontWeight: 700, fontSize: 15 }}>{business.name}</span>
      )}
    </label>
  );
  const isCurrent = (href: string) => (path === href || (href === '/more' && ['/program', '/info', '/alerts', '/qr', '/more'].includes(path)) ? 'page' : undefined);

  return (
    <div className="shell">
      <nav className="side" aria-label="ניווט">
        <div className="brand-row">
          <Link href="/overview" className="wordmark" aria-label="Perko לעסקים, סקירה">perk<i /></Link>
          <span className="muted tiny" style={{ paddingTop: 4 }}>לעסקים</span>
        </div>
        {Biz}
        <div className="menu">
          {SECTIONS.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
              <Icon />{label}
              {href === '/alerts' && unseen > 0 ? <span className="badge" aria-label={`${unseen} חדשות`}>{unseen}</span> : null}
            </Link>
          ))}
        </div>
        <div className="side-foot">
          {email ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span> : null}
          <button type="button" className="link" style={{ color: 'var(--muted)', display: 'inline-flex', gap: 8, alignItems: 'center' }} onClick={signOut}>
            <ExitIcon size={16} />יציאה
          </button>
        </div>
      </nav>

      <div className="content">
        <div className="content-inner">
          <header className="topbar">
            <Link href="/overview" className="wordmark" style={{ fontSize: 22 }} aria-label="Perko לעסקים, סקירה">perk<i /></Link>
            {Biz}
          </header>
          {!business.active ? <p className="note warn" style={{ marginBottom: 18 }}>העסק מושהה ב-Perko: הוא לא מופיע באפליקציה ואי אפשר לצבור בו.</p> : null}
          <main>{children}</main>
        </div>
      </div>

      <nav className="tabs" aria-label="ניווט">
        {TABS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={isCurrent(href)}>
            <Icon size={22} />{label}
            {href === '/more' && unseen > 0 ? <span className="badge" aria-label={`${unseen} התראות חדשות`}>{unseen}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
