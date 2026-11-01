// The loyalty card as customers see it in the app's wallet, drawn from the same faces, stamp colours and
// glyphs (src/cardLook.ts). Used for the live preview while editing and on the overview.
import { cardFace, STAMP_GLYPHS, stampColors, type CardLook } from '../../src/cardLook.ts';

type Props = {
  businessId: string;
  name: string;
  initial: string;
  programName: string;
  goal: number;
  current: number;
  reward: string;
  look: CardLook;
};

export function CardPreview({ businessId, name, initial, programName, goal, current, reward, look }: Props) {
  const face = cardFace(look, businessId);
  const photo = face.stamps === 'photo' ? look.imageUrl : null;
  const c = stampColors(face.stamps);
  const shown = Math.min(goal, 10);
  const filled = Math.round((current / goal) * shown);
  const glyph = look.stampShape === 'circle' ? null : STAMP_GLYPHS[look.stampShape];
  const missing = Math.max(0, goal - current);

  return (
    <div
      className="card-preview"
      role="img"
      aria-label={`הכרטיס של ${name}: ${current} מתוך ${goal}`}
      style={{ backgroundColor: face.bg, color: face.fg }}
    >
      {photo ? (
        <>
          <div className="photo" style={{ backgroundImage: `url("${photo}")` }} />
          <div className="photo" style={{ background: `rgba(17, 19, 15, ${look.overlay / 100})` }} />
        </>
      ) : (
        <div className="disc" style={{ width: '72%', aspectRatio: '1', background: face.disc, left: '-26%', bottom: '-50%' }} />
      )}
      <div style={{ position: 'absolute', top: 0, left: '5%', right: '5%', height: 1, background: face.edge }} />
      <div className="body">
        <div className="head">
          {look.logoUrl ? (
            <span className="logo img" style={{ background: face.avatarBg }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a user-uploaded file from Supabase Storage */}
              <img src={look.logoUrl} alt="" />
            </span>
          ) : (
            <span className="logo" style={{ background: face.avatarBg, color: face.avatarFg }}>{initial}</span>
          )}
          <span className="name">{name}</span>
          <span className="count">{current}<small style={{ color: face.sub }}>/{goal}</small></span>
        </div>
        <div>
          <div className="prog" style={{ color: face.sub }}>{programName}</div>
          <div className="stamps" style={{ gridTemplateColumns: `repeat(${shown}, minmax(0, 1fr))` }}>
            {Array.from({ length: shown }, (_, i) => {
              const on = i < filled;
              return (
                <span key={i} className="stamp" style={{ background: on ? c.filled : c.empty }}>
                  {glyph ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={glyph} fill="none" stroke={on ? c.onFilled : c.onEmpty} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
        <div className="foot">{missing ? `עוד ${missing} ${missing === 1 ? 'חותמת' : 'חותמות'}: ${reward}` : `ההטבה מוכנה: ${reward}`}</div>
      </div>
    </div>
  );
}
