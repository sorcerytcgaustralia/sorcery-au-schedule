import { MapBackdrop } from './MapBackdrop';

export function Masthead() {
  return (
    <header className="masthead" id="top">
      <MapBackdrop />
      <div className="masthead-inner">
        <h1 className="masthead-title">The realm Down Under gathers&nbsp;here.</h1>
        <p className="standfirst">Weekly play, major events, tournament decks and local stores for Sorcery players across Australia.</p>
        <div className="hero-actions">
          <a className="action-btn" href="#schedule">
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
