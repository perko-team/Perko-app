// Stroke icons, 24x24, drawn in currentColor. Decorative: the link or button around them carries the name.
type P = { size?: number };
const S = ({ size = 20, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const OverviewIcon = (p: P) => <S {...p}><path d="M4 19V10M10 19V5M16 19v-7M22 19H2" /></S>;
export const CardIcon = (p: P) => <S {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></S>;
export const ProgramIcon = (p: P) => <S {...p}><path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" /></S>;
export const TeamIcon = (p: P) => <S {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" /></S>;
export const LogIcon = (p: P) => <S {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></S>;
export const BellIcon = (p: P) => <S {...p}><path d="M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4" /></S>;
export const QrIcon = (p: P) => <S {...p}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></S>;
export const MoreIcon = (p: P) => <S {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></S>;
export const ChevronIcon = (p: P) => <S {...p}><path d="M15 5l-7 7 7 7" /></S>;
export const DownloadIcon = (p: P) => <S {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></S>;
export const CheckIcon = (p: P) => <S {...p}><path d="M5 12l5 5L20 7" /></S>;
export const ExitIcon = (p: P) => <S {...p}><path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M10 8l-4 4 4 4M6 12h10" /></S>;
