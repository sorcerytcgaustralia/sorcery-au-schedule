import { DISCORD_INVITE_URL, SHEET_URL } from '@/lib/config';

export function Footer({ fetchedAt }: { fetchedAt: string }) {
  const built = new Date(fetchedAt);
  const builtLabel = built.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <h4>Colophon</h4>
            <p>
              Realm of Oz is a fan-made almanac and is not affiliated with or endorsed by Erik&rsquo;s Curiosa. Sorcery: Contested Realm and all related artwork are the property of their respective owners.
            </p>
            <p>
              &ldquo;River of Flame&rdquo; art by Ian Miller. Avatar cards: &ldquo;Imposter&rdquo; and &ldquo;Avatar of Air&rdquo; by S&eacute;verine Pineaux, &ldquo;Necromancer&rdquo; by Brian Smith, &ldquo;Pathfinder&rdquo; by Drew Tucker, &ldquo;Archimago&rdquo; by Rodney Matthews.
            </p>
          </div>
          <div>
            <h4>Keep it current</h4>
            <p>
              Spotted something out of date, or want your event listed? Edit the{' '}
              <a href={SHEET_URL} target="_blank" rel="noopener">
                shared sheet
              </a>{' '}
              or say so on the{' '}
              <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener">
                Discord
              </a>
              .
            </p>
            <p>Page last assembled {builtLabel}; the sheet is re-read every visit.</p>
          </div>
          <div>
            <h4>Elsewhere</h4>
            <p>
              <a href="https://curiosa.io" target="_blank" rel="noopener">
                Curiosa
              </a>
              , the official deck builder.
              <br />
              <a href="https://sorcerytcg.com" target="_blank" rel="noopener">
                Sorcery: Contested Realm
              </a>
              , the game.
              <br />
              <a href="https://github.com/sorcerytcgaustralia/sorcery-au-schedule" target="_blank" rel="noopener">
                This site&rsquo;s source
              </a>
              .
            </p>
          </div>
        </div>
        <p className="foot-word" aria-hidden="true">
          Realm of Oz
        </p>
      </div>
    </footer>
  );
}
