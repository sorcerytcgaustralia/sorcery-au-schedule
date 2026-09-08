import Link from 'next/link';
import { DISCORD_INVITE_URL } from '@/lib/config';

export function SiteNav() {
  return (
    <nav className="nav" aria-label="Site">
      <div className="wrap nav-inner">
        <Link href="/" className="nav-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/sta-emblem.png" alt="" width={28} height={28} />
          Realm of Oz
          <small>Sorcery TCG Australia</small>
        </Link>
        <div className="nav-links">
          <Link href="/#week">This week</Link>
          <Link href="/#notices">Notices</Link>
          <Link href="/#decks">Decks</Link>
          <Link href="/hall">Hall of Fame</Link>
          <Link href="/#stores">Stores</Link>
          <a className="nav-cta" href={DISCORD_INVITE_URL} target="_blank" rel="noopener">
            Discord
          </a>
        </div>
      </div>
    </nav>
  );
}
