"use client";

// Hall of Fame: every special event that has recorded a result.
//
// Only the top four are ranked; fifth through eighth are shown together as
// the rest of the top eight, since below the cut the ordering is a Swiss
// tiebreak artefact rather than a meaningful placing.

import { recordedResults } from "@/lib/events";
import type { Placing, SpecialEvent } from "@/lib/sheet/types";
import { specialDateLabels } from "@/lib/time";
import { useSiteData } from "./SiteDataProvider";

const RANKS = ["1st", "2nd", "3rd", "4th"];

function DeckLink({ entry }: { entry: Placing }) {
  if (!entry.deck) return null;
  return (
    <a
      className="deck-link"
      href={entry.deck}
      target="_blank"
      rel="noopener"
      aria-label={`View ${entry.player}’s deck on SorceryTCG`}
    >
      View deck
    </a>
  );
}

function HallEvent({ ev }: { ev: SpecialEvent }) {
  const champion = ev.results.find((r) => r.place === 1);
  const runners = ev.results.filter((r) => r.place > 1 && r.place <= 4);
  const rest = ev.results.filter((r) => r.place > 4);
  const where = [
    specialDateLabels(ev.start, ev.end).dateLabel,
    ev.city,
    ev.venue,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <article className={"hall-event" + (ev.tier ? " tier-" + ev.tier : "")}>
      <div className="hall-event-head">
        <h2 className="hall-event-name">{ev.event}</h2>
        <p className="hall-event-meta">{where}</p>
      </div>
      <div className="hall-event-body">
        {champion && (
          <div className="champion">
            <p className="champion-label">Champion</p>
            <p className="champion-name">{champion.player}</p>
            {champion.deck && (
              <a
                className="champion-deck"
                href={champion.deck}
                target="_blank"
                rel="noopener"
              >
                View the winning deck
              </a>
            )}
          </div>
        )}
        {runners.length > 0 && (
          <ol className="podium">
            {runners.map((r) => (
              <li key={r.place} className={`podium-row place-${r.place}`}>
                <span className="podium-rank">{RANKS[r.place - 1]}</span>
                <span className="podium-player">{r.player}</span>
                <DeckLink entry={r} />
              </li>
            ))}
          </ol>
        )}
        {rest.length > 0 && (
          <div className="top-eight">
            <h3 className="top-eight-label">Also in the top eight</h3>
            <ul className="top-eight-list">
              {rest.map((r) => (
                <li key={r.place} className="top-eight-row">
                  <span className="top-eight-player">{r.player}</span>
                  <DeckLink entry={r} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

export function HallList() {
  const { data } = useSiteData();
  const events = recordedResults(data.special);
  if (data.failed.includes("special") && data.special.length === 0) {
    return (
      <p className="hall-note">
        Couldn&rsquo;t load the results right now. Check the Discord.
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <p className="hall-note">
        No results recorded yet. Once an event has its placings entered, it will
        appear here.
      </p>
    );
  }
  return (
    <div id="hall-list">
      {events.map((ev) => (
        <HallEvent key={ev.start + ev.event} ev={ev} />
      ))}
    </div>
  );
}
