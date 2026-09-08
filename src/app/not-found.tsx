import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';

export default function NotFound() {
  return (
    <>
      <SiteNav home={false} />
      <main className="page">
        <div className="page-inner">
          <h1 className="statement">Off the chart</h1>
          <p className="lede">
            That page does not exist. Try <Link href="/">the Realm</Link> or <Link href="/hall">the Record</Link>.
          </p>
        </div>
      </main>
    </>
  );
}
