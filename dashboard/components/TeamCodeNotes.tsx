// Three answers owners asked for about the team code: why it is shown once, what "איפוס" does, and what to do
// when you work alone. Shown on the first-run guide and on "צוות".
export const TEAM_CODE_NOTES = [
  { q: 'למה הקוד מוצג רק פעם אחת?', a: 'אנחנו לא שומרים את הקוד עצמו, רק טביעה מוצפנת שלו. כך גם מי שיקבל גישה לחשבון לא יוכל לראות אותו. שכחתם? עושים איפוס.' },
  { q: 'מה עושה ״איפוס״?', a: 'יוצר קוד חדש במקום הישן. הקוד הישן מפסיק לעבוד מיד, והפעולות שאושרו בו נשארות ביומן.' },
  { q: 'אני עובד/ת לבד', a: 'בוחרים ״קוד אחד לכל הצוות״ ושומרים את הקוד במקום שרק אתם רואים. בקופה אתם מקלידים אותו על הטלפון של הלקוח.' },
] as const;

export function TeamCodeNotes() {
  return (
    <dl className="notes-qa">
      {TEAM_CODE_NOTES.map((n) => (
        <div key={n.q}>
          <dt>{n.q}</dt>
          <dd>{n.a}</dd>
        </div>
      ))}
    </dl>
  );
}
