import { DISCORD_INVITE_URL, SHEET_URL } from '@/lib/config';

export function Footer() {
  return (
    <footer className="foot">
      <div className="foot-inner">
        <p>
          This register is kept by the players. Spotted something out of date, or want your table listed? Edit the{' '}
          <a href={SHEET_URL} target="_blank" rel="noopener">
            shared sheet
          </a>{' '}
          or say so on the{' '}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener">
            Sorcery TCG Australia Discord
          </a>
          .
        </p>
        <p className="foot-small">Sorcery TCG Australia is a fan-made community and is not affiliated with or endorsed by Erik&rsquo;s Curiosa. Sorcery: Contested Realm and all related artwork are the property of their respective owners. River of Flame by Ian Miller. Imposter and Avatar of Air by S&eacute;verine Pineaux, Necromancer by Brian Smith, Pathfinder by Drew Tucker, Archimago by Rodney Matthews.</p>
        <p className="foot-small">realmofoz.com</p>
      </div>
    </footer>
  );
}
