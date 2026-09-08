import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="wrap lost">
        <p className="crumbs mono" style={{ color: 'var(--text-3)' }}>
          Error 404
        </p>
        <h1 className="page-title">Lost in the realm</h1>
        <p className="page-stand">
          That page does not exist, or has wandered off the map. Try the <Link href="/">front page</Link> or the <Link href="/hall">Hall of Fame</Link>.
        </p>
      </main>
    </>
  );
}
