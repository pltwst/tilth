// Hand-made SVG art. Every drawing uses a 100×100 box and the same ink outline.
const INK = 'var(--ink-art)';
const svg = (body, cls = 'art') =>
  `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

const shadow = (rx = 20) => `<ellipse cx="50" cy="89" rx="${rx}" ry="4.5" fill="#000" opacity=".13" stroke="none"/>`;
const leaf = (d, fill = '#6aa84f') => `<path d="${d}" fill="${fill}"/>`;

const seedling = (fill = '#7cb85a') =>
  shadow(12) +
  `<path d="M50 88 V64" fill="none"/>` +
  leaf('M50 66 C38 66 32 58 33 50 C43 50 50 56 50 66 Z', fill) +
  leaf('M50 62 C60 62 68 55 67 46 C57 46 50 52 50 62 Z', fill);

const ART = {
  clover: () =>
    shadow(18) +
    `<path d="M50 88 C50 78 51 70 50 60" fill="none"/>` +
    ['50,37', '36,53', '64,53']
      .map((c) => {
        const [x, y] = c.split(',');
        return `<circle cx="${x}" cy="${y}" r="13.5" fill="#5f9e4a"/><path d="M${x} ${y - 6} V${+y + 5}" stroke="#a9d68f" stroke-width="2.5" fill="none"/>`;
      })
      .join('') +
    `<circle cx="50" cy="51" r="4" fill="#3f7a35"/>`,

  poppy: () =>
    shadow(16) +
    `<path d="M50 88 C47 74 54 66 50 54" fill="none"/>` +
    leaf('M49 78 C40 76 34 70 34 64 C42 64 48 70 49 78 Z') +
    `<circle cx="40" cy="34" r="13" fill="#e2553e"/><circle cx="60" cy="34" r="13" fill="#e2553e"/>` +
    `<circle cx="40" cy="48" r="13" fill="#d8432f"/><circle cx="60" cy="48" r="13" fill="#d8432f"/>` +
    `<circle cx="50" cy="41" r="7.5" fill="#2e2421"/>` +
    `<circle cx="47" cy="39" r="1.6" fill="#f2d16b" stroke="none"/><circle cx="53" cy="43" r="1.6" fill="#f2d16b" stroke="none"/>`,

  bluebell: () => {
    const bell = (x, y) =>
      `<path d="M${x} ${y} C${x - 9} ${y} ${x - 9} ${y + 9} ${x - 10} ${y + 15} L${x + 10} ${y + 15} C${x + 9} ${y + 9} ${x + 9} ${y} ${x} ${y} Z" fill="#7484dc"/>` +
      `<path d="M${x - 10} ${y + 15} l3 4 l3 -4 l4 4 l4 -4 l3 4 l3 -4" fill="#7484dc"/>`;
    return (
      shadow(18) +
      leaf('M44 88 C34 78 30 66 31 54 C40 62 45 74 44 88 Z', '#5f9e4a') +
      `<path d="M47 88 C46 60 52 32 74 24" fill="none"/>` +
      `<path d="M50 52 C47 50 44 50 41 50 M56 38 C56 36 57 33 58 31 M68 27 C70 30 71 32 72 35" fill="none"/>` +
      bell(38, 48) + bell(58, 30) + bell(73, 34)
    );
  },

  // Age 0..2: the cap darkens as it gets close to rotting.
  puffball: (age = 0) => {
    const cap = ['#f6ecda', '#ead5b0', '#d4b080'][Math.min(age, 2)];
    return (
      shadow(24) +
      `<path d="M38 88 C38 78 42 74 50 74 C58 74 62 78 62 88 Z" fill="#efe2c8"/>` +
      `<path d="M24 70 C24 46 36 36 50 36 C64 36 76 46 76 70 C70 76 30 76 24 70 Z" fill="${cap}"/>` +
      `<circle cx="40" cy="52" r="3" fill="#b9946a" stroke="none"/><circle cx="56" cy="47" r="3.6" fill="#b9946a" stroke="none"/>` +
      `<circle cx="62" cy="61" r="2.6" fill="#b9946a" stroke="none"/><circle cx="46" cy="64" r="2.2" fill="#b9946a" stroke="none"/>`
    );
  },

  sunflower: (age, ripe) => {
    if (!ripe) return seedling() + `<circle cx="50" cy="45" r="5" fill="#8cc06a"/>`;
    let petals = '';
    for (let a = 0; a < 360; a += 30)
      petals += `<ellipse cx="50" cy="20" rx="6.5" ry="12" fill="#f5c22f" transform="rotate(${a} 50 34)"/>`;
    return (
      shadow(16) +
      `<path d="M50 88 V48" fill="none"/>` +
      leaf('M50 74 C40 74 32 68 31 60 C41 59 49 65 50 74 Z') +
      leaf('M50 66 C60 66 68 60 69 52 C59 51 51 57 50 66 Z') +
      petals +
      `<circle cx="50" cy="34" r="12" fill="#6e4524"/>` +
      `<circle cx="46" cy="31" r="1.8" fill="#a77345" stroke="none"/><circle cx="54" cy="35" r="1.8" fill="#a77345" stroke="none"/><circle cx="49" cy="38" r="1.8" fill="#a77345" stroke="none"/>`
    );
  },

  birch: (age, ripe) => {
    if (!ripe)
      return (
        shadow(12) +
        `<path d="M50 88 V52 M50 66 L58 58 M50 74 L42 66" fill="none"/>` +
        leaf('M58 58 C58 50 64 46 70 46 C70 54 64 58 58 58 Z', '#a5cc5f') +
        leaf('M42 66 C42 58 36 54 30 54 C30 62 36 66 42 66 Z', '#a5cc5f') +
        leaf('M50 52 C44 46 46 38 50 34 C54 38 56 46 50 52 Z', '#a5cc5f')
      );
    return (
      shadow(18) +
      `<path d="M45 88 L46 50 H54 L55 88 Z" fill="#f4f1ea"/>` +
      `<path d="M46 62 H50 M52 72 H55 M45 80 H49 M50 55 H53" fill="none" stroke-width="3"/>` +
      `<circle cx="36" cy="40" r="15" fill="#b7d86a"/><circle cx="64" cy="40" r="15" fill="#b7d86a"/>` +
      `<circle cx="50" cy="27" r="17" fill="#c8e27a"/>` +
      `<path d="M44 22 C46 19 50 18 53 19" fill="none" stroke="#eef6c8" stroke-width="2.5"/>`
    );
  },

  redwood: (age, ripe) => {
    if (!ripe)
      return (
        shadow(12) +
        `<path d="M50 88 V74" fill="none"/>` +
        `<path d="M50 44 L64 76 H36 Z" fill="#3f8a63"/>` +
        `<path d="M50 44 L58 62 H42 Z" fill="#4f9c72"/>`
      );
    return (
      shadow(18) +
      `<path d="M45 88 L46 72 H54 L55 88 Z" fill="#b2563a"/>` +
      `<path d="M50 30 L74 74 H26 Z" fill="#2e6b4d"/>` +
      `<path d="M50 18 L69 56 H31 Z" fill="#367a58"/>` +
      `<path d="M50 6 L63 36 H37 Z" fill="#409064"/>`
    );
  },
};

export function plantArt(plant, ripe) {
  return svg(ART[plant.kind](plant.age ?? 0, ripe));
}

export const sickleArt = () =>
  svg(
    `<path d="M30 84 L42 66" stroke-width="11" stroke="${INK}"/>` +
      `<path d="M30 84 L42 66" stroke-width="5" stroke="#c98a4b"/>` +
      `<path d="M42 66 C30 46 38 18 64 14 C82 12 92 26 88 36 C80 26 66 24 56 32 C48 40 46 54 48 64 Z" fill="#d9dee3"/>` +
      `<path d="M60 22 C70 19 80 22 85 29" fill="none" stroke="#fff" stroke-width="2.5"/>`,
  );

export const beeArt = () =>
  svg(
    `<ellipse cx="38" cy="30" rx="15" ry="11" fill="#fff" opacity=".9" transform="rotate(-25 38 30)"/>` +
      `<ellipse cx="60" cy="27" rx="14" ry="10" fill="#fff" opacity=".9" transform="rotate(20 60 27)"/>` +
      `<ellipse cx="50" cy="56" rx="26" ry="20" fill="#f6c33b"/>` +
      `<path d="M40 38 C36 48 36 64 40 74 M56 37 C52 48 52 64 56 75" fill="none" stroke-width="7"/>` +
      `<circle cx="74" cy="52" r="3" fill="${INK}" stroke="none"/>`,
    'art bee',
  );
