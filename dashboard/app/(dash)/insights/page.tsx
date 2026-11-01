import { redirect } from 'next/navigation';

// The insights now live on the overview.
export default function Insights() {
  redirect('/overview');
}
