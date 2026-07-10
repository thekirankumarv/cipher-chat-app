export type BlobShape = {
  pathD: string;
  fillColor: string;
};

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POINTS = 8;
const SIZE = 100;
const CENTER = SIZE / 2;
const BASE_RADIUS = SIZE * 0.36;

export function generateBlob(seed: string): BlobShape {
  const hash = hashSeed(seed);
  const random = mulberry32(hash);

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2;
    const radius = BASE_RADIUS * (0.75 + random() * 0.5);
    points.push({
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle),
    });
  }

  let pathD = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} `;
  for (let i = 0; i < POINTS; i++) {
    const current = points[i];
    const next = points[(i + 1) % POINTS];
    const midX = ((current.x + next.x) / 2).toFixed(2);
    const midY = ((current.y + next.y) / 2).toFixed(2);
    pathD += `Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midX} ${midY} `;
  }
  pathD += "Z";

  const hue = hash % 360;
  const fillColor = `hsl(${hue}, 62%, 58%)`;

  return { pathD, fillColor };
}
