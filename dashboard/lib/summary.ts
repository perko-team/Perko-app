// The overview's words: one-sentence definitions for each number, and the week in one line. No imports, so the
// root unit tests can load it (tests/dashboardSummary.test.ts).

export const METRIC_DEFINITIONS = {
  visits: 'כל חותמת שהצוות אישר בקופה היא ביקור אחד.',
  active: 'לקוחות שאספו לפחות חותמת אחת בתקופה.',
  returning: 'מתוך הלקוחות הפעילים, מי שביקר ביומיים שונים או יותר בתקופה.',
  redeemed: 'מימוש: הצוות אישר בקופה שלקוח קיבל את ההטבה שלו.',
  openCards: 'כרטיסים של לקוחות שעוד אוספים חותמות, או שמלאים ומחכים להטבה.',
  nearReward: 'כרטיסים שחסר להם ביקור אחד בלבד עד ההטבה.',
  readyCards: 'כרטיסים מלאים שההטבה שלהם עוד לא נמסרה.',
} as const;

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/** "השבוע: 42 ביקורים, 9 לקוחות חוזרים, 3 הטבות". */
export function weekSummary(w: { visits: number; returning: number; redeemed: number }): string {
  if (w.visits === 0) return 'השבוע עוד לא היו ביקורים.';
  return `השבוע: ${count(w.visits, 'ביקור אחד', 'ביקורים')}, ${count(w.returning, 'לקוח חוזר אחד', 'לקוחות חוזרים')}, ${count(w.redeemed, 'הטבה אחת', 'הטבות')}`;
}
