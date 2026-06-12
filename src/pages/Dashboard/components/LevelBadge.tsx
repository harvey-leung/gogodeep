export const LEVELS = [
  { level: 1,  name: "Bronze",   xpReq: 0,     color: "#9a5b1e", glow: "#9a5b1e40", inner: "#c97d38", text: "#fff" },
  { level: 2,  name: "Silver",   xpReq: 100,   color: "#5a6472", glow: "#5a647240", inner: "#8a97a4", text: "#fff" },
  { level: 3,  name: "Gold",     xpReq: 400,   color: "#c47d00", glow: "#c47d0040", inner: "#e8a800", text: "#fff" },
  { level: 4,  name: "Platinum", xpReq: 1000,  color: "#4060a0", glow: "#4060a040", inner: "#6888c8", text: "#fff" },
  { level: 5,  name: "Diamond",  xpReq: 2000,  color: "#0099bb", glow: "#0099bb40", inner: "#00c8e8", text: "#fff" },
  { level: 6,  name: "Emerald",  xpReq: 3500,  color: "#1a8c4e", glow: "#1a8c4e40", inner: "#28b864", text: "#fff" },
  { level: 7,  name: "Ruby",     xpReq: 5500,  color: "#c0241a", glow: "#c0241a40", inner: "#e84030", text: "#fff" },
  { level: 8,  name: "Sapphire", xpReq: 8000,  color: "#1464a8", glow: "#1464a840", inner: "#2888d4", text: "#fff" },
  { level: 9,  name: "Obsidian", xpReq: 11000, color: "#6b3090", glow: "#6b309040", inner: "#9040c0", text: "#fff" },
  { level: 10, name: "Master",   xpReq: 15000, color: "#c84800", glow: "#c8480040", inner: "#f06000", text: "#fff" },
] as const;
export type Level = typeof LEVELS[number];

function hexPath(cx: number, cy: number, r: number): string {
  return "M " + Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 30) * Math.PI / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" L ") + " Z";
}

export function LevelBadge({ lvl, size = 52 }: { lvl: Level; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.43, ri = r * 0.70;
  const id = `lvl-${lvl.level}-${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={lvl.inner} />
          <stop offset="100%" stopColor={lvl.color} />
        </radialGradient>
      </defs>
      <path d={hexPath(cx, cy, r + 3)} fill={lvl.glow} />
      <path d={hexPath(cx, cy, r)} fill={`url(#${id})`} />
      <path d={hexPath(cx, cy, ri)} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle"
        fill={lvl.text} fontSize={size * 0.32} fontWeight="900" fontFamily="system-ui,sans-serif">
        {lvl.level}
      </text>
    </svg>
  );
}

export function AchievementBadge({ xp }: { xp: number }) {
  const lvl = [...LEVELS].reverse().find((l) => xp >= l.xpReq) ?? LEVELS[0];
  if (lvl.level <= 1) return null;
  return <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: lvl.color, color: lvl.text }}>{lvl.name}</span>;
}
