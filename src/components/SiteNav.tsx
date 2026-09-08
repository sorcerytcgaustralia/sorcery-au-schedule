'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

const LINKS: [string, string][] = [
  ['realm', 'Realm'],
  ['register', 'Register'],
  ['meta', 'Meta'],
  ['record', 'Record'],
  ['places', 'Places'],
];

export function SiteNav({ home = true }: { home?: boolean }) {
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const measure = () => document.documentElement.style.setProperty('--nav-h', Math.ceil(el.getBoundingClientRect().height) + 'px');
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const onScroll = () => el.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[data-section]'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) => a.classList.toggle('active', a.dataset.section === entry.target.id));
        });
      },
      { rootMargin: '-40% 0px -50% 0px' },
    );
    if (home) LINKS.forEach(([id]) => document.getElementById(id) && io.observe(document.getElementById(id) as Element));
    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [home]);

  return (
    <nav className="nav" aria-label="Site" ref={nav}>
      <div className="nav-inner">
        <Link className="nav-brand" href={home ? '#realm' : '/'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="nav-emblem" src="/art/sta-emblem.png" alt="" width={119} height={128} />
          <span>Sorcery TCG Australia</span>
        </Link>
        <div className="nav-links">
          {LINKS.map(([id, label]) =>
            id === 'record' && !home ? (
              <Link key={id} href="/hall" className="active" aria-current="page">
                {label}
              </Link>
            ) : (
              <Link key={id} href={home ? `#${id}` : `/#${id}`} data-section={id}>
                {label}
              </Link>
            ),
          )}
        </div>
      </div>
    </nav>
  );
}
