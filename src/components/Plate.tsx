export function Plate() {
  return (
    <figure className="plate" aria-label="River of Flame, by Ian Miller">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/river-of-flame.jpg" alt="River of Flame: a wall of orange fire in which faces howl and grin" width={1464} height={1036} loading="lazy" decoding="async" />
      <figcaption>
        <span className="cap-no">Plate I</span>
        <span className="cap-title">River of Flame</span>
        <span className="cap-artist">Ian Miller, for Sorcery: Contested Realm</span>
      </figcaption>
    </figure>
  );
}
