export function Masthead() {
  return (
    <header className="masthead" id="top">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="masthead-art" src="/art/river-of-flame.jpg" alt="" aria-hidden="true" width={1464} height={1036} fetchPriority="high" decoding="async" />
      <div className="masthead-scrim" aria-hidden="true" />
      <div className="masthead-inner">
        <h1 className="masthead-title">The realm Down Under gathers&nbsp;here.</h1>
        <p className="standfirst">Weekly play, major events, tournament decks and local stores for Sorcery players across Australia.</p>
        <div className="hero-actions">
          <a className="hero-link" href="#schedule">
            Explore the schedule
          </a>
          <a className="hero-link" href="#join">
            Join the community
          </a>
        </div>
      </div>
    </header>
  );
}
