import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';

export default function NotFound() {
  return (
    <>
      <SiteNav home={false} />
      <main className="lost">
        <h1 className="hall-title">Lost in the realm</h1>
        <p>
          That page does not exist, or has wandered off the map. Try the <Link href="/">home page</Link> or the <Link href="/hall">Hall of Fame</Link>.
        </p>
      </main>
    </>
  );
}
