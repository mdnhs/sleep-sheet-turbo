// Flat 2D illustrations for the blog covers (scripts/generate-blog-covers.ts).
// Each one is SVG drawn in a 400×400 box, in the brand palette with a plum
// outline, and sits on a stitched "cushion" on the cover.

export const INK = "#4A0C24";
export const ROSE = "#FF6FA5";
export const MAGENTA = "#B8245A";
export const MARIGOLD = "#F2B33D";
export const ICE = "#8EC3E6";
export const ICE_DEEP = "#3F86BC";
export const WHITE = "#FFFFFF";
export const ROSE_LIGHT = "#FFD9E6";
export const ICE_LIGHT = "#D9ECF8";
export const MARIGOLD_LIGHT = "#FCE6B4";

const line = (w = 6) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const stitch = (color = MAGENTA, w = 3) =>
  `fill="none" stroke="${color}" stroke-width="${w}" stroke-dasharray="9 7" stroke-linecap="round"`;

function snowflake(cx: number, cy: number, r: number) {
  const arms = [0, 60, 120]
    .map((a) => {
      const t = (a * Math.PI) / 180;
      const dx = Math.cos(t) * r;
      const dy = Math.sin(t) * r;
      return `<line x1="${cx - dx}" y1="${cy - dy}" x2="${cx + dx}" y2="${cy + dy}"/>`;
    })
    .join("");
  return `<g stroke="${ICE_DEEP}" stroke-width="5" stroke-linecap="round">${arms}<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="${WHITE}"/></g>`;
}

function star(cx: number, cy: number, r: number, fill: string) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const t = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(t) * rad).toFixed(1)},${(cy + Math.sin(t) * rad).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}" ${line(4)}/>`;
}

function sparkle(cx: number, cy: number, r: number, fill: string) {
  return `<path d="M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z" fill="${fill}" ${line(3)}/>`;
}

function heart(cx: number, cy: number, s: number, fill: string) {
  return `<path transform="translate(${cx} ${cy}) scale(${s})" d="M0 10 C-14 -2 -22 -14 -12 -22 C-6 -27 0 -22 0 -16 C0 -22 6 -27 12 -22 C22 -14 14 -2 0 10Z" fill="${fill}" ${line(4 / s)}/>`;
}

/** A folded blanket seen from the front: a rounded slab with a quilting stitch. */
function folded(x: number, y: number, w: number, h: number, fill: string, stitchColor = WHITE) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h / 2.4, 22)}" fill="${fill}" ${line(5)}/>
    <rect x="${x + 10}" y="${y + 9}" width="${w - 20}" height="${h - 18}" rx="${Math.min(h / 3, 14)}" ${stitch(stitchColor, 3)}/>`;
}

/** A bed from the side, comforter drawn over it. */
function bedSide(comforter: string) {
  return `
    <rect x="34" y="120" width="40" height="215" rx="14" fill="${MAGENTA}" ${line()}/>
    <rect x="80" y="296" width="18" height="40" rx="6" fill="${INK}"/>
    <rect x="336" y="296" width="18" height="40" rx="6" fill="${INK}"/>
    <rect x="70" y="250" width="296" height="52" rx="14" fill="${WHITE}" ${line()}/>
    <rect x="86" y="206" width="86" height="44" rx="18" fill="${ROSE_LIGHT}" ${line()}/>
    <path d="M150 214 Q170 196 200 198 L350 198 Q372 198 372 220 L372 296 Q372 312 356 312 L182 312 Q166 312 166 296 L166 236 Q160 222 150 214Z" fill="${comforter}" ${line()}/>
    <path d="M218 206 V304 M266 206 V304 M314 206 V304" ${stitch(WHITE, 3)}/>`;
}

function priceTag(fill: string) {
  return `<g transform="rotate(-12 200 150)">
      <path d="M118 78 H292 Q312 78 312 98 V202 Q312 222 292 222 H118 L58 150Z" fill="${fill}" ${line()}/>
      <circle cx="104" cy="150" r="13" fill="${WHITE}" ${line(5)}/>
      <text x="222" y="190" text-anchor="middle" font-family="Hind Siliguri" font-weight="700" font-size="118" fill="${INK}">৳</text>
    </g>
    <path d="M96 140 C70 110 50 80 70 52" fill="none" ${line(5)}/>`;
}

const ART = {
  /** Washing machine with a sheet in the drum, bubbles, folded sheets. */
  washing: () => `
    <defs><clipPath id="drum"><circle cx="180" cy="222" r="58"/></clipPath></defs>
    <rect x="62" y="48" width="236" height="296" rx="28" fill="${WHITE}" ${line()}/>
    <line x1="62" y1="108" x2="298" y2="108" ${line()}/>
    <circle cx="98" cy="78" r="11" fill="${MARIGOLD}" ${line(4)}/>
    <circle cx="134" cy="78" r="11" fill="${ROSE}" ${line(4)}/>
    <rect x="196" y="68" width="78" height="20" rx="7" fill="${ICE_LIGHT}" ${line(4)}/>
    <circle cx="180" cy="222" r="82" fill="${ICE_LIGHT}" ${line()}/>
    <circle cx="180" cy="222" r="58" fill="${ICE}"/>
    <g clip-path="url(#drum)">
      <path d="M110 236 q17 -16 34 0 t34 0 t34 0 t34 0 V300 H110Z" fill="${ICE_DEEP}" opacity="0.55"/>
      <path d="M142 214 C156 180 210 182 208 214 C206 240 168 244 160 224" fill="${ROSE}" ${line(4)}/>
    </g>
    <circle cx="180" cy="222" r="58" fill="none" ${line(5)}/>
    <circle cx="330" cy="70" r="20" fill="${WHITE}" ${line(4)}/>
    <circle cx="352" cy="124" r="12" fill="${WHITE}" ${line(4)}/>
    <circle cx="318" cy="150" r="8" fill="${WHITE}" ${line(4)}/>
    ${folded(286, 302, 104, 40, MAGENTA)}
    ${folded(294, 262, 92, 40, ROSE)}`,

  /** A trophy with ১০ for the top-ten list. */
  trophy: () => `
    <path d="M128 92 H272 V150 A72 72 0 0 1 128 150Z" fill="${MARIGOLD}" ${line()}/>
    <path d="M128 112 H100 A32 32 0 0 0 132 172 M272 112 H300 A32 32 0 0 1 268 172" fill="none" ${line()}/>
    <rect x="184" y="220" width="32" height="38" fill="${MARIGOLD}" ${line()}/>
    <rect x="140" y="256" width="120" height="30" rx="8" fill="${MAGENTA}" ${line()}/>
    <rect x="116" y="286" width="168" height="36" rx="10" fill="${ROSE}" ${line()}/>
    <text x="200" y="182" text-anchor="middle" font-family="Hind Siliguri" font-weight="700" font-size="70" fill="${INK}">১০</text>
    ${star(70, 96, 24, ROSE)}
    ${star(336, 78, 19, MAGENTA)}
    ${star(330, 214, 14, WHITE)}
    ${sparkle(78, 236, 14, WHITE)}`,

  /** Pillow, bolster and a measuring tape. */
  pillowSize: () => `
    <rect x="40" y="44" width="250" height="28" rx="6" fill="${MARIGOLD}" ${line(5)}/>
    <path d="${Array.from({ length: 11 }, (_, i) => `M${60 + i * 22} 44 V${i % 2 ? 56 : 62}`).join(" ")}" ${line(3)}/>
    <circle cx="318" cy="66" r="32" fill="${MARIGOLD}" ${line(5)}/>
    <circle cx="318" cy="66" r="12" fill="${WHITE}" ${line(4)}/>
    <path d="M66 126 Q56 98 90 104 L310 104 Q344 98 334 126 L340 214 Q346 244 310 238 L90 238 Q54 244 60 214Z" fill="${ROSE}" ${line()}/>
    <rect x="88" y="124" width="224" height="96" rx="20" ${stitch(WHITE)}/>
    <rect x="70" y="270" width="270" height="62" rx="31" fill="${MAGENTA}" ${line()}/>
    <ellipse cx="80" cy="301" rx="14" ry="31" fill="${ROSE}" ${line(5)}/>
    <ellipse cx="330" cy="301" rx="14" ry="31" fill="${ROSE}" ${line(5)}/>
    <path d="M120 276 V326 M170 276 V326 M220 276 V326 M270 276 V326" ${stitch(WHITE)}/>`,

  /** Quilt, duvet and comforter stacked: thin to thick. */
  threeStack: () => `
    ${folded(64, 246, 272, 86, MAGENTA)}
    <path d="M118 256 V322 M172 256 V322 M226 256 V322 M280 256 V322" ${stitch(WHITE)}/>
    <rect x="84" y="182" width="232" height="62" rx="18" fill="${ROSE}" ${line(5)}/>
    ${[120, 160, 200, 240, 280].map((x) => `<circle cx="${x}" cy="213" r="6" fill="${WHITE}" ${line(3)}/>`).join("")}
    <rect x="104" y="132" width="192" height="48" rx="12" fill="${ROSE_LIGHT}" ${line(5)}/>
    <path d="M116 156 L140 140 L164 156 L188 140 L212 156 L236 140 L260 156 L284 140 M116 156 L140 172 L164 156 L188 172 L212 156 L236 172 L260 156 L284 172" ${stitch(MAGENTA, 3)}/>
    ${sparkle(330, 112, 18, MARIGOLD)}
    ${sparkle(70, 150, 12, WHITE)}`,

  /** Bed with snowflakes and a done tick: getting ready for winter. */
  winterPrep: () => `
    ${bedSide(ROSE)}
    ${snowflake(90, 62, 22)}
    ${snowflake(200, 104, 16)}
    ${snowflake(250, 48, 13)}
    <circle cx="330" cy="104" r="36" fill="${MARIGOLD}" ${line()}/>
    <path d="M312 104 L326 118 L350 92" fill="none" ${line(7)}/>`,

  /** Bed under a crescent moon: sleeping warm in winter. */
  cozyNight: () => `
    ${bedSide(MAGENTA)}
    <path d="M300 40 A54 54 0 1 0 352 112 A42 42 0 1 1 300 40Z" fill="${MARIGOLD}" ${line()}/>
    ${star(110, 70, 13, WHITE)}
    ${star(196, 44, 10, MARIGOLD)}
    ${snowflake(180, 128, 15)}
    <text x="96" y="182" font-family="Hind Siliguri" font-weight="700" font-size="40" fill="${INK}">z</text>
    <text x="124" y="156" font-family="Hind Siliguri" font-weight="700" font-size="30" fill="${INK}">z</text>`,

  /** Twill weave against a plain weave, with a vs badge. */
  twillVsPlain: () => `
    <defs>
      <clipPath id="sw1"><rect x="40" y="70" width="160" height="190" rx="18"/></clipPath>
      <clipPath id="sw2"><rect x="200" y="140" width="160" height="190" rx="18"/></clipPath>
    </defs>
    <rect x="40" y="70" width="160" height="190" rx="18" fill="${ROSE}"/>
    <g clip-path="url(#sw1)" stroke="${MAGENTA}" stroke-width="7">
      ${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 22 - 160}" y1="270" x2="${i * 22 + 40}" y2="70"/>`).join("")}
    </g>
    <rect x="40" y="70" width="160" height="190" rx="18" fill="none" ${line()}/>
    <rect x="200" y="140" width="160" height="190" rx="18" fill="${WHITE}"/>
    <g clip-path="url(#sw2)" stroke="${ROSE_LIGHT}" stroke-width="5">
      ${Array.from({ length: 12 }, (_, i) => `<line x1="${200 + i * 16}" y1="140" x2="${200 + i * 16}" y2="330"/><line x1="200" y1="${140 + i * 16}" x2="360" y2="${140 + i * 16}"/>`).join("")}
    </g>
    <rect x="200" y="140" width="160" height="190" rx="18" fill="none" ${line()}/>
    <circle cx="200" cy="200" r="40" fill="${MARIGOLD}" ${line()}/>
    <text x="200" y="214" text-anchor="middle" font-family="Hind Siliguri" font-weight="700" font-size="38" fill="${INK}">vs</text>`,

  /** Bed seen from above with its width and length marked. */
  bedSize: () => `
    <rect x="90" y="44" width="220" height="26" rx="10" fill="${MAGENTA}" ${line()}/>
    <rect x="98" y="68" width="204" height="262" rx="18" fill="${WHITE}" ${line()}/>
    <rect x="112" y="82" width="80" height="40" rx="14" fill="${ROSE_LIGHT}" ${line(5)}/>
    <rect x="208" y="82" width="80" height="40" rx="14" fill="${ROSE_LIGHT}" ${line(5)}/>
    <path d="M98 140 H302 V312 Q302 330 284 330 H116 Q98 330 98 312Z" fill="${ROSE}" ${line()}/>
    <rect x="98" y="140" width="204" height="28" fill="${MAGENTA}" ${line(5)}/>
    <path d="M98 364 H302 M98 352 V376 M302 352 V376" fill="none" ${line(5)}/>
    <path d="M110 356 L98 364 L110 372 M290 356 L302 364 L290 372" fill="none" ${line(5)}/>
    <path d="M342 68 V330 M330 68 H354 M330 330 H354" fill="none" ${line(5)}/>
    <path d="M334 80 L342 68 L350 80 M334 318 L342 330 L350 318" fill="none" ${line(5)}/>`,

  /** Price tag over folded bed sheets. */
  sheetPrice: () => `
    ${folded(70, 292, 260, 42, ROSE)}
    ${folded(84, 252, 232, 42, MAGENTA)}
    ${priceTag(MARIGOLD)}`,

  /** Price tag over a puffy folded comforter. */
  comforterPrice: () => `
    ${folded(60, 254, 280, 82, MAGENTA)}
    <path d="M116 264 V326 M172 264 V326 M228 264 V326 M284 264 V326" ${stitch(WHITE)}/>
    ${priceTag(ROSE)}`,

  /** Clipboard checklist with a heart: setting up a new home. */
  checklist: () => `
    <rect x="96" y="60" width="208" height="292" rx="18" fill="${MARIGOLD}" ${line()}/>
    <rect x="116" y="96" width="168" height="236" rx="10" fill="${WHITE}" ${line(5)}/>
    <rect x="160" y="44" width="80" height="34" rx="10" fill="${MAGENTA}" ${line()}/>
    ${[132, 182, 232, 282]
      .map(
        (y, i) => `<rect x="134" y="${y}" width="28" height="28" rx="7" fill="${i < 3 ? ROSE : WHITE}" ${line(4)}/>
        ${i < 3 ? `<path d="M140 ${y + 14} L147 ${y + 21} L157 ${y + 8}" fill="none" ${line(4)}/>` : ""}
        <line x1="176" y1="${y + 14}" x2="${i % 2 ? 248 : 266}" y2="${y + 14}" stroke="${ROSE_LIGHT}" stroke-width="10" stroke-linecap="round"/>`,
      )
      .join("")}
    ${heart(320, 300, 1.6, ROSE)}
    ${sparkle(72, 112, 14, WHITE)}`,

  /** A fan of colour chips: choosing colours and prints. */
  palette: () => `
    ${[
      [-48, ICE],
      [-24, MARIGOLD],
      [0, ROSE],
      [24, MAGENTA],
      [48, "#7E3A64"],
    ]
      .map(
        ([angle, fill]) => `<g transform="rotate(${angle} 200 330)">
          <rect x="164" y="80" width="72" height="250" rx="16" fill="${fill}" ${line(5)}/>
          <rect x="174" y="268" width="52" height="40" rx="8" fill="${WHITE}" ${line(4)}/>
        </g>`,
      )
      .join("")}
    <circle cx="200" cy="330" r="15" fill="${WHITE}" ${line(5)}/>
    ${sparkle(60, 70, 16, MARIGOLD)}
    ${sparkle(345, 92, 12, WHITE)}`,

  /** Lep, kombol and comforter side by side. */
  threeKinds: () => `
    <rect x="22" y="170" width="104" height="150" rx="26" fill="${MARIGOLD}" ${line()}/>
    <path d="M38 200 H110 M38 230 H110 M38 260 H110 M38 290 H110" ${stitch(INK, 3)}/>
    <rect x="148" y="186" width="104" height="122" rx="10" fill="${ICE}" ${line()}/>
    <path d="${Array.from({ length: 7 }, (_, i) => `M${158 + i * 14} 308 V326`).join(" ")}" ${line(4)}/>
    <rect x="274" y="164" width="104" height="156" rx="28" fill="${ROSE}" ${line()}/>
    <path d="M284 202 Q326 214 368 202 M284 242 Q326 254 368 242 M284 282 Q326 294 368 282" fill="none" stroke="${WHITE}" stroke-width="4"/>
    <text x="137" y="140" text-anchor="middle" font-family="Hind Siliguri" font-weight="700" font-size="34" fill="${MAGENTA}">vs</text>
    <text x="263" y="140" text-anchor="middle" font-family="Hind Siliguri" font-weight="700" font-size="34" fill="${MAGENTA}">vs</text>
    ${snowflake(70, 84, 18)}
    ${snowflake(330, 90, 15)}`,

  /** A wrapped gift in the snow. */
  gift: () => `
    <rect x="112" y="182" width="176" height="150" rx="12" fill="${MAGENTA}" ${line()}/>
    <rect x="96" y="146" width="208" height="46" rx="10" fill="${ROSE}" ${line()}/>
    <rect x="184" y="146" width="32" height="186" fill="${MARIGOLD}" ${line(5)}/>
    <path d="M200 146 C170 96 128 112 150 140 C160 150 186 148 200 146 C214 148 240 150 250 140 C272 112 230 96 200 146Z" fill="${MARIGOLD}" ${line(5)}/>
    ${snowflake(64, 96, 22)}
    ${snowflake(336, 120, 18)}
    ${snowflake(340, 300, 14)}
    ${heart(64, 280, 1.3, ROSE)}`,

  /** A clean folded comforter drying in the sun. */
  care: () => `
    <circle cx="306" cy="92" r="36" fill="${MARIGOLD}" ${line()}/>
    <path d="${[0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => {
        const t = (a * Math.PI) / 180;
        return `M${(306 + Math.cos(t) * 48).toFixed(1)} ${(92 + Math.sin(t) * 48).toFixed(1)} L${(306 + Math.cos(t) * 62).toFixed(1)} ${(92 + Math.sin(t) * 62).toFixed(1)}`;
      })
      .join(" ")}" ${line(5)}/>
    <path d="M92 70 C92 70 62 112 62 132 A30 30 0 0 0 122 132 C122 112 92 70 92 70Z" fill="${ICE}" ${line()}/>
    ${folded(60, 266, 280, 70, MAGENTA)}
    ${folded(78, 198, 244, 66, ROSE)}
    ${heart(200, 232, 1, WHITE)}
    ${sparkle(150, 166, 16, MARIGOLD)}
    ${sparkle(338, 210, 12, WHITE)}`,

  /** Fallback: a stack of folded bedding. */
  bedding: () => `
    ${folded(60, 262, 280, 72, MAGENTA)}
    ${folded(78, 194, 244, 66, ROSE)}
    ${folded(96, 134, 208, 58, ROSE_LIGHT, MAGENTA)}
    ${sparkle(330, 112, 18, MARIGOLD)}
    ${heart(76, 128, 1.3, ROSE)}`,
} as const;

export type ArtName = keyof typeof ART;

/** The cushion colour behind each illustration. */
const TINT: Record<ArtName, string> = {
  washing: ICE_LIGHT,
  trophy: MARIGOLD_LIGHT,
  pillowSize: ROSE_LIGHT,
  threeStack: ROSE_LIGHT,
  winterPrep: ICE_LIGHT,
  cozyNight: ICE_LIGHT,
  twillVsPlain: MARIGOLD_LIGHT,
  bedSize: ICE_LIGHT,
  sheetPrice: MARIGOLD_LIGHT,
  comforterPrice: MARIGOLD_LIGHT,
  checklist: ROSE_LIGHT,
  palette: ROSE_LIGHT,
  threeKinds: ICE_LIGHT,
  gift: ROSE_LIGHT,
  care: ROSE_LIGHT,
  bedding: ROSE_LIGHT,
};

export function art(name: ArtName): { svg: string; tint: string } {
  return { svg: ART[name](), tint: TINT[name] };
}

/** Picks an illustration for a post nobody chose one for, from its title and slug. */
export function artFor(title: string, slug: string): ArtName {
  const t = `${title} ${slug}`.toLowerCase();
  const isComforter = /comforter|কম্ফোর্টার|লেপ|কম্বল/.test(t);
  if (/ধোয়া|wash/.test(t)) return "washing";
  if (/top ?10|সেরা ১০|ব্র্যান্ড|brand/.test(t)) return "trophy";
  if (/বালিশ|pillow/.test(t)) return "pillowSize";
  if (/price|দাম/.test(t)) return isComforter ? "comforterPrice" : "sheetPrice";
  if (/size|সাইজ|মাপ/.test(t)) return "bedSize";
  if (/উপহার|gift/.test(t)) return "gift";
  if (/যত্ন|care|রক্ষণাবেক্ষণ/.test(t)) return "care";
  if (/রং|ডিজাইন|color|colour|design/.test(t)) return "palette";
  if (/checklist|চেকলিস্ট|সংসার/.test(t)) return "checklist";
  if (/twill|টুইল/.test(t)) return "twillVsPlain";
  if (/লেপ|কম্বল/.test(t)) return "threeKinds";
  if (/duvet|ডুভেট|quilt|কুইল্ট/.test(t)) return "threeStack";
  if (/ঘুম|sleep/.test(t)) return "cozyNight";
  if (/শীত|winter/.test(t)) return "winterPrep";
  return "bedding";
}
