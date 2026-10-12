// A short confetti burst that appears to come out from behind an element:
// particles start inside `source`'s box and are not drawn until they leave it
// (the element "covers" them); once out they stay visible, arc up and
// outwards, fall back over the page and fade away. A
// temporary full-screen canvas is added for the burst and removed after it.
// No dependency; skipped entirely for reduced-motion users.

const COLORS = ["#FF6FA5", "#B8245A", "#1FE27F", "#16C172", "#FFD166", "#FFFFFF"];
const DURATION_MS = 1400;
const COUNT = 90;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  round: boolean;
  emerged: boolean;
}

export function burstConfetti(source: DOMRect): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "60",
  });
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const centerX = source.left + source.width / 2;
  const particles: Particle[] = Array.from({ length: COUNT }, () => {
    // Anywhere along the element's width, in its upper part so they clear its
    // top edge quickly; pushed away from the centre so the burst fans out.
    const x = source.left + Math.random() * source.width;
    const outward = (x - centerX) / (source.width / 2 || 1);
    return {
      x,
      y: source.top + Math.random() * Math.min(source.height * 0.5, 120),
      vx: outward * (2 + Math.random() * 4) + (Math.random() - 0.5) * 3,
      vy: -(6 + Math.random() * 7),
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      round: Math.random() < 0.3,
      emerged: false,
    };
  });

  const inside = (p: Particle) =>
    p.x > source.left && p.x < source.right && p.y > source.top && p.y < source.bottom;

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const elapsed = now - start;
    // Normalise to 60fps steps so the motion is the same on any refresh rate.
    const step = Math.min(3, (now - last) / 16.67);
    last = now;
    const fade = Math.max(0, 1 - Math.max(0, elapsed - DURATION_MS * 0.55) / (DURATION_MS * 0.45));

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalAlpha = fade;
    for (const p of particles) {
      p.vy += 0.3 * step;
      p.vx *= Math.pow(0.985, step);
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.rotation += p.spin * step;
      if (!p.emerged) {
        if (inside(p)) continue;
        p.emerged = true;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }

    if (elapsed < DURATION_MS) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  // Animation frames pause in a hidden tab; never leave the canvas behind.
  window.setTimeout(() => canvas.remove(), DURATION_MS + 1000);
}
