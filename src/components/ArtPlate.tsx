import Image from 'next/image';

export function ArtPlate() {
  return (
    <figure className="plate">
      <Image src="/art/river-of-flame.jpg" width={1464} height={1036} alt="River of Flame: a wall of orange fire in which dozens of faces howl and grin" priority sizes="100vw" />
      <figcaption>
        Plate I · <b>River of Flame</b> · Ian Miller
      </figcaption>
    </figure>
  );
}
