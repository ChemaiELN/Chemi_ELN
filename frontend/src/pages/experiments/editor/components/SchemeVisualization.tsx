import React from 'react'

// Compute the 6 vertices of a flat-top hexagon centred at (cx,cy) with radius r.
// i=0 → top vertex, going clockwise.
const hexPts = (cx: number, cy: number, r: number): [number, number][] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * (Math.PI / 180)
    return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)]
  }) as [number, number][]

const hexStr = (cx: number, cy: number, r: number) =>
  hexPts(cx, cy, r)
    .map(([x, y]) => `${x},${y}`)
    .join(' ')

// ─── Sub-helpers ─────────────────────────────────────────────────────────────
const FONT = "13px 'Courier New', monospace"
const LABEL_FONT = "11px Arial, sans-serif"
const BOND = '#1c1917'
const OXYGEN = '#dc2626'
const LABEL_CLR = '#78716c'
const ARROW_CLR = '#0f766e'

// Benzene ring (hexagon + aromatic inner circle)
const Benzene: React.FC<{ cx: number; cy: number; r?: number }> = ({
  cx, cy, r = 30,
}) => {
  const pts = hexStr(cx, cy, r)
  return (
    <>
      <polygon points={pts} fill="none" stroke={BOND} strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={+(r * 0.58).toFixed(1)} fill="none" stroke={BOND} strokeWidth="1.5" />
    </>
  )
}

// Carbonyl group (C with =O drawn perpendicular upward from (bx, by))
export const Carbonyl: React.FC<{ bx: number; by: number; dir?: 'up' | 'down' }> = ({
  bx, by, dir = 'up',
}) => {
  const dy = dir === 'up' ? -1 : 1
  return (
    <>
      <line x1={bx} y1={by} x2={bx} y2={by + dy * 20} stroke={BOND} strokeWidth="1.5" />
      <line x1={bx + 4} y1={by} x2={bx + 4} y2={by + dy * 20} stroke={BOND} strokeWidth="1.5" />
      <text x={bx - 1} y={by + dy * 26} style={{ font: FONT }} fill={OXYGEN}
        textAnchor="middle" dominantBaseline="middle">O</text>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * Static SVG showing the Aspirin synthesis reaction scheme:
 *   Salicylic Acid + Acetic Anhydride ─H₃PO₄/Δ→ Acetylsalicylic Acid + Acetic Acid
 */
const SchemeVisualization: React.FC = () => {
  const r = 30
  // ── Salicylic acid ──────────────────────────────────────────────
  const SA_CX = 105
  const SA_CY = 88
  const sa = hexPts(SA_CX, SA_CY, r)
  // v1 = top-right, v2 = bottom-right

  // ── Aspirin ──────────────────────────────────────────────────────
  const ASP_CX = 548
  const ASP_CY = 88
  const asp = hexPts(ASP_CX, ASP_CY, r)

  return (
    <svg
      viewBox="0 0 920 178"
      width="100%"
      style={{ display: 'block', background: '#fff', borderRadius: 6 }}
      aria-label="Aspirin synthesis reaction scheme"
    >
      {/* ================================================================
          SALICYLIC ACID
          ================================================================ */}
      <Benzene cx={SA_CX} cy={SA_CY} r={r} />

      {/* –OH at v1 (top-right) */}
      <line x1={sa[1][0]} y1={sa[1][1]} x2={sa[1][0] + 24} y2={sa[1][1] - 18} stroke={BOND} strokeWidth="1.5" />
      <text x={sa[1][0] + 27} y={sa[1][1] - 20} style={{ font: FONT }} fill={OXYGEN}>OH</text>

      {/* –COOH at v2 (bottom-right) */}
      <line x1={sa[2][0]} y1={sa[2][1]} x2={sa[2][0] + 24} y2={sa[2][1] + 18} stroke={BOND} strokeWidth="1.5" />
      <text x={sa[2][0] + 27} y={sa[2][1] + 22} style={{ font: FONT }} fill={BOND}>COOH</text>

      {/* Label */}
      <text x={SA_CX} y="162" style={{ font: LABEL_FONT }} fill={LABEL_CLR} textAnchor="middle">Salicylic Acid</text>

      {/* ================================================================
          PLUS SIGN #1
          ================================================================ */}
      <text x="210" y="95" fontSize="22" fill={LABEL_CLR} textAnchor="middle" fontFamily="Arial,sans-serif">+</text>

      {/* ================================================================
          ACETIC ANHYDRIDE:  CH₃–C(=O)–O–C(=O)–CH₃
          ================================================================ */}
      {/* CH₃ */}
      <text x="228" y="96" style={{ font: FONT }} fill={BOND}>CH₃</text>
      {/* bond → C */}
      <line x1="258" y1="88" x2="275" y2="88" stroke={BOND} strokeWidth="1.5" />
      {/* C */}
      <text x="276" y="94" style={{ font: FONT }} fill={BOND}>C</text>
      {/* =O above */}
      <line x1="281" y1="80" x2="281" y2="62" stroke={BOND} strokeWidth="1.5" />
      <line x1="285" y1="80" x2="285" y2="62" stroke={BOND} strokeWidth="1.5" />
      <text x="280" y="58" style={{ font: FONT }} fill={OXYGEN}>O</text>
      {/* bond → O bridge */}
      <line x1="289" y1="88" x2="306" y2="88" stroke={BOND} strokeWidth="1.5" />
      <text x="307" y="94" style={{ font: FONT }} fill={OXYGEN}>O</text>
      {/* bond → C */}
      <line x1="317" y1="88" x2="334" y2="88" stroke={BOND} strokeWidth="1.5" />
      {/* C */}
      <text x="335" y="94" style={{ font: FONT }} fill={BOND}>C</text>
      {/* =O above */}
      <line x1="340" y1="80" x2="340" y2="62" stroke={BOND} strokeWidth="1.5" />
      <line x1="344" y1="80" x2="344" y2="62" stroke={BOND} strokeWidth="1.5" />
      <text x="339" y="58" style={{ font: FONT }} fill={OXYGEN}>O</text>
      {/* bond → CH₃ */}
      <line x1="348" y1="88" x2="365" y2="88" stroke={BOND} strokeWidth="1.5" />
      <text x="366" y="94" style={{ font: FONT }} fill={BOND}>CH₃</text>

      {/* Label */}
      <text x="311" y="162" style={{ font: LABEL_FONT }} fill={LABEL_CLR} textAnchor="middle">Acetic Anhydride</text>

      {/* ================================================================
          REACTION ARROW (teal, with H₃PO₄ above and Δ below)
          ================================================================ */}
      <line x1="415" y1="84" x2="493" y2="84" stroke={ARROW_CLR} strokeWidth="2.2" />
      <polygon points="491,78 503,84 491,90" fill={ARROW_CLR} />
      <text x="458" y="72" style={{ font: '11px Arial,sans-serif' }} fill={LABEL_CLR} textAnchor="middle">H₃PO₄</text>
      <text x="458" y="105" style={{ font: '13px Arial,sans-serif' }} fill={LABEL_CLR} textAnchor="middle">Δ</text>

      {/* ================================================================
          ASPIRIN (Acetylsalicylic Acid)
          ================================================================ */}
      <Benzene cx={ASP_CX} cy={ASP_CY} r={r} />

      {/* –O–CO–CH₃ ester at v1 (top-right) */}
      {/* O-link */}
      <line x1={asp[1][0]} y1={asp[1][1]} x2={asp[1][0] + 22} y2={asp[1][1] - 16} stroke={BOND} strokeWidth="1.5" />
      <text x={asp[1][0] + 25} y={asp[1][1] - 18} style={{ font: FONT }} fill={OXYGEN}>O</text>
      {/* bond to carbonyl C */}
      <line x1={asp[1][0] + 34} y1={asp[1][1] - 22} x2={asp[1][0] + 51} y2={asp[1][1] - 22} stroke={BOND} strokeWidth="1.5" />
      {/* C of ester */}
      <text x={asp[1][0] + 52} y={asp[1][1] - 18} style={{ font: FONT }} fill={BOND}>C</text>
      {/* =O above the ester carbonyl */}
      <line x1={asp[1][0] + 57} y1={asp[1][1] - 26} x2={asp[1][0] + 57} y2={asp[1][1] - 44} stroke={BOND} strokeWidth="1.5" />
      <line x1={asp[1][0] + 61} y1={asp[1][1] - 26} x2={asp[1][0] + 61} y2={asp[1][1] - 44} stroke={BOND} strokeWidth="1.5" />
      <text x={asp[1][0] + 56} y={asp[1][1] - 48} style={{ font: FONT }} fill={OXYGEN}>O</text>
      {/* bond to CH₃ */}
      <line x1={asp[1][0] + 64} y1={asp[1][1] - 22} x2={asp[1][0] + 81} y2={asp[1][1] - 22} stroke={BOND} strokeWidth="1.5" />
      <text x={asp[1][0] + 82} y={asp[1][1] - 18} style={{ font: FONT }} fill={BOND}>CH₃</text>

      {/* –COOH at v2 (bottom-right) */}
      <line x1={asp[2][0]} y1={asp[2][1]} x2={asp[2][0] + 22} y2={asp[2][1] + 16} stroke={BOND} strokeWidth="1.5" />
      <text x={asp[2][0] + 25} y={asp[2][1] + 20} style={{ font: FONT }} fill={BOND}>COOH</text>

      {/* Label */}
      <text x={ASP_CX} y="162" style={{ font: LABEL_FONT }} fill={LABEL_CLR} textAnchor="middle">Acetylsalicylic Acid</text>

      {/* ================================================================
          PLUS SIGN #2
          ================================================================ */}
      <text x="730" y="95" fontSize="22" fill={LABEL_CLR} textAnchor="middle" fontFamily="Arial,sans-serif">+</text>

      {/* ================================================================
          ACETIC ACID:  CH₃–C(=O)–OH
          ================================================================ */}
      <text x="745" y="96" style={{ font: FONT }} fill={BOND}>CH₃</text>
      <line x1="775" y1="88" x2="792" y2="88" stroke={BOND} strokeWidth="1.5" />
      <text x="793" y="94" style={{ font: FONT }} fill={BOND}>C</text>
      <line x1="799" y1="80" x2="799" y2="62" stroke={BOND} strokeWidth="1.5" />
      <line x1="803" y1="80" x2="803" y2="62" stroke={BOND} strokeWidth="1.5" />
      <text x="798" y="58" style={{ font: FONT }} fill={OXYGEN}>O</text>
      <line x1="805" y1="88" x2="822" y2="88" stroke={BOND} strokeWidth="1.5" />
      <text x="823" y="94" style={{ font: FONT }} fill={OXYGEN}>OH</text>

      {/* Label */}
      <text x="793" y="162" style={{ font: LABEL_FONT }} fill={LABEL_CLR} textAnchor="middle">Acetic Acid</text>
    </svg>
  )
}

export default SchemeVisualization
