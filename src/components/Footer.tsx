import { DISCORD_INVITE_URL } from '@/lib/config';

export function Footer({ variant = 'home' }: { variant?: 'home' | 'hall' | 'daily' }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-p">
          {variant === 'hall' ? 'Results missing or wrong? Let us know on the ' : variant === 'daily' ? 'Share your result, or tell us about a wrong clue, on the ' : 'Spotted something out of date, or want to add your event to the schedule? Let us know on the '}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener" className="discord-link">
            Sorcery TCG Australia Discord
          </a>
          .
        </p>
        <p className="footer-disclaimer">This is a fan-made website and is not affiliated with or endorsed by Erik&rsquo;s Curiosa. Sorcery: Contested Realm and all related artwork are the property of their respective owners.</p>
        {variant === 'daily' && (
          <p className="footer-disclaimer">
            Card data from{' '}
            <a href="https://kairosarchive.net" target="_blank" rel="noopener">
              KairosArchive
            </a>
            .
          </p>
        )}
        {variant === 'home' && (
          <p className="footer-disclaimer">
            &ldquo;River of Flame&rdquo; art by Ian Miller. Avatar cards: &ldquo;Imposter&rdquo; and &ldquo;Avatar of Air&rdquo; art by S&eacute;verine Pineaux, &ldquo;Necromancer&rdquo; art by Brian Smith, &ldquo;Pathfinder&rdquo; art by Drew Tucker, &ldquo;Archimago&rdquo; art by Rodney Matthews.
          </p>
        )}
      </div>
    </footer>
  );
}
