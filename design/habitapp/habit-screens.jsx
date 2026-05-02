// habit-screens.jsx — The Mindful Canvas design system applied
// Synced with updated codebase + DESIGN.md

const { useState, useEffect } = React;

// ── Design tokens — The Mindful Canvas ───────────────────────
// Surface hierarchy (tonal layering, no borders)
const C = {
  // Surfaces — nested like physical layers of fine paper
  bg:                    '#fbf9f5',  // Main app canvas
  surface:               '#f5f2eb',  // surface-container-low — large content blocks
  surfaceCard:           '#ffffff',  // surface-container-lowest — floating cards
  surfaceHigh:           '#ede9e0',  // surface-container-high — deeper tonal
  surfaceMuted:          '#f0ece3',  // surface-container — muted sections

  // Text
  text:                  '#31332f',  // on-surface — all primary reading text
  textMuted:             '#6b6e67',  // on-surface-variant
  textFaint:             '#9a9d96',  // placeholder / captions

  // Brand
  primary:               '#446655',  // Signature actions / success
  primaryLight:          '#c6ebd5',  // primary-container (gradient end)
  primarySoft:           '#e8f5ee',  // accent soft bg
  primaryText:           '#ffffff',  // on-primary

  // Semantic
  success:               '#446655',  // same as primary (no "success green")
  danger:                '#9b3b3b',

  // Ghost border fallback (15% opacity, for accessibility only)
  ghostBorder:           'rgba(178,178,173,0.15)',

  // Heatmap
  heatDone:              '#446655',
  heatSkipped:           '#e6d3a8',
  heatMissed:            '#ede9e0',
};

// Typography scale
const T = {
  displayLg:  36,
  headlineLg: 28,
  headlineMd: 22,
  titleLg:    20,
  titleMd:    18,
  bodyLg:     16,
  bodyMd:     14,
  labelMd:    13,
  micro:      11,
};

// Spacing
const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

// Radius
const R = {
  sm:   12,   // rounded-sm
  md:   24,   // rounded-md — standard cards, inputs
  lg:   32,   // rounded-lg
  xl:   48,   // rounded-xl — Zen containers
  pill: 999,
};

// Shadows — ambient, primary-tinted
const SHADOW_CARD   = '0 8px 32px rgba(68,102,85,0.08)';
const SHADOW_LIFT   = '0 2px 12px rgba(68,102,85,0.06)';
const SHADOW_BUTTON = '0 4px 20px rgba(68,102,85,0.22)';

const SERIF = "'Plus Jakarta Sans', system-ui, sans-serif";
const SANS  = "'Manrope', system-ui, sans-serif";

// Signature gradient for primary actions
const GRAD_PRIMARY = 'linear-gradient(135deg, #446655 0%, #5a8a6e 100%)';
const GRAD_SUBTLE  = 'linear-gradient(135deg, rgba(68,102,85,0.06) 0%, rgba(198,235,213,0.2) 100%)';

// ── Brand mark SVG — 3 rounded squares (outline) + 1 circle (solid fill) ──
function LogoMark({ size = 44, color = C.primary, opacity = 1 }) {
  // Replicates the 2×2 grid from the app icon exactly
  // Grid: top-left = rounded square, top-right = circle (solid), bottom-left = rounded square, bottom-right = rounded square
  const s = size;
  const gap = s * 0.08;
  const cell = (s - gap) / 2;
  const stroke = s * 0.09;
  const r = cell * 0.28; // rounded corner radius for squares

  const tl = { x: 0,          y: 0 };
  const tr = { x: cell + gap, y: 0 };
  const bl = { x: 0,          y: cell + gap };
  const br = { x: cell + gap, y: cell + gap };

  const circleR = cell / 2;
  const circleCx = tr.x + circleR;
  const circleCy = tr.y + circleR;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" style={{ opacity, flexShrink: 0 }}>
      {/* Top-left — rounded square, outline */}
      <rect x={tl.x + stroke/2} y={tl.y + stroke/2} width={cell - stroke} height={cell - stroke} rx={r} ry={r} stroke={color} strokeWidth={stroke} fill="none" />
      {/* Top-right — circle, solid fill */}
      <circle cx={circleCx} cy={circleCy} r={circleR - stroke/2} fill={color} />
      {/* Bottom-left — rounded square, outline */}
      <rect x={bl.x + stroke/2} y={bl.y + stroke/2} width={cell - stroke} height={cell - stroke} rx={r} ry={r} stroke={color} strokeWidth={stroke} fill="none" />
      {/* Bottom-right — rounded square, outline */}
      <rect x={br.x + stroke/2} y={br.y + stroke/2} width={cell - stroke} height={cell - stroke} rx={r} ry={r} stroke={color} strokeWidth={stroke} fill="none" />
    </svg>
  );
}

// ── Icon library ─────────────────────────────────────────────
const Icon = {
  check: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  flame: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2c0 6-6 8-6 13a6 6 0 0012 0c0-5-6-7-6-13z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/></svg>
  ),
  skip: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8"/><path d="M9 8l6 4-6 4V8z" fill={c}/></svg>
  ),
  calendar: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="3" stroke={c} strokeWidth="1.8"/><path d="M8 2v4M16 2v4M3 10h18" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>
  ),
  sun: (c='currentColor', s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke={c} strokeWidth="1.8"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>
  ),
  sunset: (c='currentColor', s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 7a5 5 0 015 5H7a5 5 0 015-5z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 3v2M4.22 6.22l1.42 1.42M19.78 6.22l-1.42 1.42M2 17h20" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>
  ),
  moon: (c='currentColor', s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/></svg>
  ),
  circle: (c='currentColor', s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8"/></svg>
  ),
  user: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>
  ),
  zap: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/></svg>
  ),
  sparkle: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/></svg>
  ),
  edit: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  archive: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="5" rx="2" stroke={c} strokeWidth="1.8"/><path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" stroke={c} strokeWidth="1.8"/><path d="M10 12h4" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>
  ),
  repeat: (c='currentColor', s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  chevronRight: (c='currentColor', s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  x: (c='currentColor', s=16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>
  ),
  tag: (c='currentColor', s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/><circle cx="7" cy="7" r="1.5" fill={c}/></svg>
  ),
  link: (c='currentColor', s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>
  ),
  library: (c='currentColor', s=22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/></svg>
  ),
  settings: (c='currentColor', s=22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>
  ),
  today: (c='currentColor', s=22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8"/></svg>
  ),
};

// ══════════════════════════════════════════════════════════════
// SHARED ATOMS
// ══════════════════════════════════════════════════════════════

// Primary — Signature Gradient, pill, generous padding
function PrimaryBtn({ label, onClick, disabled = false, icon }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '18px 40px',
        background: disabled ? C.surfaceHigh : GRAD_PRIMARY,
        color: disabled ? C.textMuted : C.primaryText,
        border: 'none', borderRadius: R.pill,
        fontSize: T.bodyLg, fontWeight: 700, fontFamily: SANS,
        cursor: disabled ? 'default' : 'pointer',
        opacity: hov && !disabled ? 0.92 : 1,
        boxShadow: disabled ? 'none' : SHADOW_BUTTON,
        transition: 'opacity 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.sm,
        letterSpacing: '0.01em',
      }}
    >
      {icon && icon}{label}
    </button>
  );
}

// Secondary — no border, tonal surface background
function SecondaryBtn({ label, onClick, disabled = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '16px 40px',
        background: hov && !disabled ? C.surfaceHigh : C.surfaceCard,
        color: C.text,
        border: 'none', borderRadius: R.pill,
        fontSize: T.bodyLg, fontWeight: 600, fontFamily: SANS,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow: SHADOW_LIFT,
        transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}

// Tertiary — text-only, minimal pressure
function TertiaryBtn({ label, onClick, disabled = false }) {
  return (
    <button onClick={!disabled ? onClick : undefined} style={{
      background: 'none', border: 'none', padding: '12px',
      color: C.primary, fontSize: T.bodyMd, fontWeight: 600,
      fontFamily: SANS, cursor: 'pointer', opacity: disabled ? 0.5 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%',
    }}>{label}</button>
  );
}

// TextField — "invisible" input: surface-container-low bg, no border, rounded-md
function TextField({ label, placeholder, value, onChange, multiline = false, secureTextEntry = false, error }) {
  const [focused, setFocused] = useState(false);
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: focused ? C.surfaceCard : C.surface,
    border: error ? `1.5px solid ${C.danger}` : focused ? `1.5px solid ${C.primary}` : 'none',
    borderRadius: R.sm,
    padding: `${S.md}px ${S.lg}px`,
    fontSize: T.bodyLg, color: C.text, fontFamily: SANS,
    outline: 'none', lineHeight: '26px', resize: 'none',
    transition: 'background 0.18s, border 0.18s',
    minHeight: multiline ? 84 : 'auto',
    boxShadow: focused ? SHADOW_LIFT : 'none',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.xs + 2 }}>
      <span style={{
        fontSize: T.labelMd, fontWeight: 600, fontFamily: SANS,
        color: focused ? C.primary : error ? C.danger : C.textMuted,
        letterSpacing: '0.01em', transition: 'color 0.18s',
      }}>{label}</span>
      {multiline
        ? <textarea rows={3} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={inputStyle} />
        : <input type={secureTextEntry ? 'password' : 'text'}
            placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={inputStyle} />
      }
      {error && <span style={{ fontSize: T.bodyMd, color: C.danger }}>{error}</span>}
    </div>
  );
}

// ChoicePills — time selector, tonal
function ChoicePills({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
      <span style={{ fontSize: T.labelMd, fontWeight: 600, color: C.textMuted, fontFamily: SANS }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.sm }}>
        {options.map(opt => {
          const sel = value === opt;
          return (
            <button key={opt} onClick={() => onChange(sel ? '' : opt)} style={{
              padding: `${S.sm}px ${S.lg}px`, borderRadius: R.pill,
              background: sel ? GRAD_PRIMARY : C.surface,
              color: sel ? C.primaryText : C.text,
              border: 'none',
              fontSize: T.bodyMd, fontWeight: 600, cursor: 'pointer',
              fontFamily: SANS, transition: 'all 0.15s',
              boxShadow: sel ? SHADOW_LIFT : 'none',
            }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

// Zen card container — rounded-md (2rem), no border, ambient shadow, tonal surface
function ZenCard({ children, bg, style = {} }) {
  return (
    <div style={{
      background: bg || C.surfaceCard,
      borderRadius: R.md,
      padding: `${S.xl}px ${S.xl}px`,
      display: 'flex', flexDirection: 'column', gap: S.lg,
      boxShadow: SHADOW_CARD,
      ...style,
    }}>
      {children}
    </div>
  );
}

// Eyebrow — small uppercase label
function Eyebrow({ children, color }) {
  return (
    <div style={{
      fontSize: T.micro, fontWeight: 700,
      color: color || C.textMuted,
      textTransform: 'uppercase', letterSpacing: '0.09em',
      fontFamily: SANS,
    }}>{children}</div>
  );
}

// Row label + value — no dividers, use vertical space
function RowLV({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.xs }}>
      <div style={{ fontSize: T.micro, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: T.bodyLg, color: C.text, lineHeight: '26px' }}>{value}</div>
    </div>
  );
}

// TabBar — glassmorphism floating nav
function TabBar({ active = 'Today', onTab }) {
  const tabs = [
    { name: 'Today',    icon: a => Icon.today(a ? C.primary : C.textMuted, 22) },
    { name: 'Library',  icon: a => Icon.library(a ? C.primary : C.textMuted, 22) },
    { name: 'Settings', icon: a => Icon.settings(a ? C.primary : C.textMuted, 22) },
  ];
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around',
      paddingBottom: 28, paddingTop: S.md,
      background: `rgba(251,249,245,0.85)`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      flexShrink: 0,
    }}>
      {tabs.map(({ name, icon: renderIcon }) => {
        const isActive = active === name;
        return (
          <div key={name} onClick={() => onTab && onTab(name)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: S.xs, cursor: 'pointer', flex: 1, paddingTop: S.sm }}>
            {renderIcon(isActive)}
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.04em', color: isActive ? C.primary : C.textMuted, fontFamily: SANS }}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────
function Heatmap({ days = 30, logs = [] }) {
  const config = days === 90
    ? { rows: 9, cols: 10, cellSize: 22 }
    : { rows: 5, cols: 6, cellSize: 32 };
  const { rows, cols, cellSize } = config;
  const GAP = 5;

  const today = new Date();
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  const todayStr = today.toISOString().split('T')[0];
  const statusByDate = {};
  for (const log of logs) statusByDate[log.log_date] = log.status;

  function cellColor(status) {
    if (status === 'done')    return C.heatDone;
    if (status === 'skipped') return C.heatSkipped;
    return C.heatMissed;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, alignSelf: 'flex-start' }}>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} style={{ display: 'flex', gap: GAP }}>
          {Array.from({ length: cols }).map((__, colIdx) => {
            const idx = rowIdx * cols + colIdx;
            if (idx >= dates.length) return <div key={colIdx} style={{ width: cellSize, height: cellSize }} />;
            const date = dates[idx];
            const status = statusByDate[date] ?? null;
            const isToday = date === todayStr;
            return (
              <div key={colIdx} style={{
                width: cellSize, height: cellSize,
                borderRadius: 6,
                background: cellColor(status),
                outline: isToday && !status ? `2px solid ${C.primary}` : 'none',
                outlineOffset: -2,
                opacity: status ? 1 : 0.6,
              }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── IdentityStreakDisplay ─────────────────────────────────────
function IdentityStreakDisplay({ identityNoun, streak }) {
  let copy;
  if (streak === 0) copy = 'Day one. Start showing up.';
  else if (identityNoun) copy = `You've been a ${identityNoun} for ${streak} ${streak === 1 ? 'day' : 'days'}.`;
  else copy = `You've shown up ${streak} ${streak === 1 ? 'day' : 'days'} for this habit.`;
  return (
    <div style={{ fontSize: T.bodyLg, color: C.text, fontStyle: 'italic', lineHeight: '26px', fontFamily: SANS }}>{copy}</div>
  );
}

// ── MissBanner — tonal, no border ────────────────────────────
function MissBanner({ onDismiss }) {
  return (
    <div style={{ background: C.surface, borderRadius: R.sm, padding: `${S.md}px ${S.lg}px`, display: 'flex', alignItems: 'center', gap: S.sm }}>
      <div style={{ flex: 1, fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>
        Yesterday was a miss. The science says it didn't matter. Keep going.
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textFaint, display: 'flex', padding: S.xs, fontSize: 22, lineHeight: 1, fontWeight: 300 }}>×</button>
    </div>
  );
}

// ── RecoveryModal — glassmorphism bottom sheet ────────────────
function RecoveryModal({ visible, habitTitle, onRestart, onMakeItSmaller, onPauseForNow, onClose }) {
  if (!visible) return null;
  const actions = [
    { label: 'Restart as-is',   hint: 'Continue with the same habit. Streak resets to 0.', onClick: onRestart },
    { label: 'Make it smaller', hint: 'Edit the tiny action to something easier.',          onClick: onMakeItSmaller },
    { label: 'Pause for now',   hint: 'Archive the habit. History is preserved.',           onClick: onPauseForNow },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(49,51,47,0.35)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 100, borderRadius: 44 }}>
      <div style={{ background: `rgba(251,249,245,0.95)`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: S.xl, display: 'flex', flexDirection: 'column', gap: S.xl }}>
        <Eyebrow color={C.primary}>{habitTitle}</Eyebrow>
        <div style={{ fontSize: T.bodyLg, color: C.text, lineHeight: '28px' }}>
          The habit lost some momentum. That happens to everyone — what matters now is what you do next.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
          {actions.map(({ label, hint, onClick }) => (
            <button key={label} onClick={onClick} style={{
              background: C.surfaceCard, border: 'none', borderRadius: R.md,
              padding: `${S.lg}px ${S.xl}px`, textAlign: 'left', cursor: 'pointer', fontFamily: SANS,
              display: 'flex', flexDirection: 'column', gap: S.xs,
              boxShadow: SHADOW_LIFT,
            }}>
              <div style={{ fontSize: T.bodyLg, fontWeight: 600, color: C.text }}>{label}</div>
              <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>{hint}</div>
            </button>
          ))}
        </div>
        <TertiaryBtn label="Just close" onClick={onClose} />
      </div>
    </div>
  );
}

// ── NullableBooleanField ──────────────────────────────────────
function NullableBooleanField({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
      <div style={{ fontSize: T.bodyLg, fontWeight: 600, color: C.text, fontFamily: SANS }}>{label}</div>
      <div style={{ display: 'flex', gap: S.sm }}>
        {[['Yes', true], ['No', false]].map(([lbl, val]) => {
          const sel = value === val;
          return (
            <button key={lbl} onClick={() => onChange(val)} style={{
              padding: `${S.sm}px ${S.xl}px`, borderRadius: R.pill,
              background: sel ? GRAD_PRIMARY : C.surface,
              color: sel ? C.primaryText : C.text,
              border: 'none',
              fontSize: T.bodyMd, fontWeight: 600, cursor: 'pointer',
              fontFamily: SANS, transition: 'all 0.15s',
              boxShadow: sel ? SHADOW_LIFT : 'none',
            }}>{lbl}</button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// AUTH SCREENS
// ══════════════════════════════════════════════════════════════

function SignInScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        {/* Logo mark — small, centered, above headline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: S.xl }}>
          <img src="uploads/logo-filled-v2.png" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.75 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm, width: '100%' }}>
            <div style={{ fontFamily: SERIF, fontSize: T.displayLg, fontWeight: 800, color: C.text, lineHeight: '42px' }}>Welcome back</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px', letterSpacing: '0.02rem' }}>Sign in to keep working on your habit foundation.</div>
          </div>
        </div>
        {/* Form — tonal card */}
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xl }}>
          <TextField label="Email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <TextField label="Password" placeholder="Your password" value={password} onChange={setPassword} secureTextEntry />
          <PrimaryBtn label="Sign In" onClick={() => {}} />
          <SecondaryBtn label="Create an account" onClick={() => {}} />
        </ZenCard>
      </div>
    </div>
  );
}

function SignUpScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: S.xl }}>
          <img src="uploads/logo-filled-v2.png" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.75 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm, width: '100%' }}>
            <div style={{ fontFamily: SERIF, fontSize: T.displayLg, fontWeight: 800, color: C.text, lineHeight: '42px' }}>Create your account</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px', letterSpacing: '0.02rem' }}>We will use this to create your first habit and land you in Today.</div>
          </div>
        </div>
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xl }}>
          <TextField label="Email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <TextField label="Password" placeholder="Choose a password" value={password} onChange={setPassword} secureTextEntry />
          <PrimaryBtn label="Sign Up" onClick={() => {}} />
          <SecondaryBtn label="I already have an account" onClick={() => {}} />
        </ZenCard>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ONBOARDING SCREENS
// ══════════════════════════════════════════════════════════════

function OnboardingWelcomeScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        {/* Logo mark above hero card */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src="uploads/logo-filled-v2.png" style={{ width: 60, height: 60, objectFit: 'contain', opacity: 0.7 }} />
        </div>
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xl, padding: `${S.xxl}px` }}>
          <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>This is a tool for becoming.</div>
          <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '28px', letterSpacing: '0.02rem' }}>We help you turn who you want to be into something you can do tomorrow morning. Let's start.</div>
        </ZenCard>
        <PrimaryBtn label="Begin" onClick={() => {}} />
      </div>
    </div>
  );
}

function OnboardingBecomingScreen() {
  const [phrase, setPhrase] = useState('');
  const examples = ['a runner', 'someone who reads daily', 'a calmer person', 'a writer', 'someone who sleeps well'];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xl, padding: `${S.xxl}px` }}>
          <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>Who do you want to become?</div>
          <textarea rows={3} placeholder="Describe who you are becoming…" value={phrase} onChange={e => setPhrase(e.target.value)}
            style={{ background: C.surface, border: 'none', borderRadius: R.sm, padding: `${S.md}px ${S.lg}px`, fontSize: T.bodyLg, color: C.text, fontFamily: SANS, lineHeight: '26px', resize: 'none', outline: 'none', minHeight: 84 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
            <div style={{ fontSize: T.bodyLg, fontWeight: 600, color: C.text }}>For example:</div>
            {examples.map(e => <div key={e} style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px' }}>{e}</div>)}
          </div>
        </ZenCard>
        <PrimaryBtn label="Continue" disabled={!phrase.trim()} onClick={() => {}} />
      </div>
    </div>
  );
}

function OnboardingDailyActionScreen() {
  const [action, setAction] = useState('');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xl, padding: `${S.xxl}px` }}>
          <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>What does that person do every day?</div>
          <div style={{ fontSize: T.bodyMd, color: C.textMuted, fontStyle: 'italic' }}>Becoming: a runner</div>
          <textarea rows={3} placeholder="e.g. go for a run" value={action} onChange={e => setAction(e.target.value)}
            style={{ background: C.surface, border: 'none', borderRadius: R.sm, padding: `${S.md}px ${S.lg}px`, fontSize: T.bodyLg, color: C.text, fontFamily: SANS, lineHeight: '26px', resize: 'none', outline: 'none', minHeight: 84 }} />
          <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px' }}>Even one minute counts. We'll make it smaller in the next step.</div>
        </ZenCard>
        <PrimaryBtn label="Continue" disabled={!action.trim()} onClick={() => {}} />
      </div>
    </div>
  );
}

function OnboardingShrinkScreen() {
  const [tiny, setTiny] = useState('');
  const examples = ['Run for 2 minutes', 'Read one page', 'Sit quietly for one breath'];
  const coaching = "Habits form through repetition, not intensity. The smaller the action, the more reliable it becomes. Start absurdly small — you can always do more on the day.";
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xl, padding: `${S.xxl}px` }}>
          <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>Now let's make it laughably small.</div>
          <textarea rows={3} placeholder="" value={tiny} onChange={e => setTiny(e.target.value)}
            style={{ background: C.surface, border: 'none', borderRadius: R.sm, padding: `${S.md}px ${S.lg}px`, fontSize: T.bodyLg, color: C.text, fontFamily: SANS, lineHeight: '26px', resize: 'none', outline: 'none', minHeight: 84 }} />
          <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '28px' }}>{coaching}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
            <div style={{ fontSize: T.bodyLg, fontWeight: 600, color: C.text }}>For example:</div>
            {examples.map(e => <div key={e} style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px' }}>{e}</div>)}
          </div>
        </ZenCard>
        <PrimaryBtn label="Continue" disabled={!tiny.trim()} onClick={() => {}} />
      </div>
    </div>
  );
}

function OnboardingWorstDayScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
          <div style={{ fontSize: T.bodyMd, fontWeight: 600, color: C.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: SANS }}>Your habit</div>
          <div style={{ fontSize: T.bodyLg, color: C.text, fontStyle: 'italic', lineHeight: '26px' }}>After I close my laptop, I will run for 2 minutes</div>
        </div>
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xxl, padding: `${S.xxl}px` }}>
          <div style={{ fontFamily: SERIF, fontSize: T.headlineMd, fontWeight: 700, color: C.text, lineHeight: '32px' }}>
            If today were your worst day — sick, exhausted, stressed — could you still do this?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
            <PrimaryBtn label="Yes, I could" onClick={() => {}} />
            <SecondaryBtn label="Probably not" onClick={() => {}} />
          </div>
        </ZenCard>
      </div>
    </div>
  );
}

function OnboardingCueScreen() {
  const [cue, setCue]     = useState('');
  const [action, setAction] = useState('');
  const examples = ['after morning coffee', 'after I brush my teeth', 'after my last meeting', 'before I make dinner'];
  const coaching = "A routine cue beats a clock cue. Tying your habit to something you already do means you don't have to remember — the previous action becomes the reminder.";
  const canContinue = cue.trim().length > 0 && action.trim().length > 0;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xl, padding: `${S.xxl}px` }}>
          <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>What will trigger it?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
            <div style={{ fontSize: T.bodyLg, fontWeight: 600, color: C.text }}>After I</div>
            <textarea rows={2} placeholder="my morning coffee" value={cue} onChange={e => setCue(e.target.value)}
              style={{ background: C.surface, border: 'none', borderRadius: R.sm, padding: `${S.md}px ${S.lg}px`, fontSize: T.bodyLg, color: C.text, fontFamily: SANS, lineHeight: '26px', resize: 'none', outline: 'none', minHeight: 64 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
            <div style={{ fontSize: T.bodyLg, fontWeight: 600, color: C.text }}>I will</div>
            <textarea rows={2} placeholder="" value={action} onChange={e => setAction(e.target.value)}
              style={{ background: C.surface, border: 'none', borderRadius: R.sm, padding: `${S.md}px ${S.lg}px`, fontSize: T.bodyLg, color: C.text, fontFamily: SANS, lineHeight: '26px', resize: 'none', outline: 'none', minHeight: 64 }} />
          </div>
          <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px' }}>{coaching}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
            <div style={{ fontSize: T.bodyLg, fontWeight: 600, color: C.text }}>Routines that work well:</div>
            {examples.map(e => <div key={e} style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px' }}>{e}</div>)}
          </div>
        </ZenCard>
        <PrimaryBtn label="Continue" disabled={!canContinue} onClick={() => {}} />
      </div>
    </div>
  );
}

function OnboardingConfirmationScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xxl, padding: S.xl }}>
        <ZenCard bg={C.surfaceCard} style={{ gap: S.xxl, padding: `${S.xxl}px` }}>
          {[
            { label: 'Your becoming', value: 'a runner' },
            { label: 'Your habit',    value: 'After I close my laptop, I will run for 2 minutes' },
            { label: 'Starts',        value: 'today' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
              <div style={{ fontSize: T.bodyMd, fontWeight: 600, color: C.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontFamily: SERIF, fontSize: T.titleLg, color: C.text, lineHeight: '28px' }}>{value}</div>
            </div>
          ))}
        </ZenCard>
        <PrimaryBtn label="Start showing up." onClick={() => {}} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CORE APP
// ══════════════════════════════════════════════════════════════

function TodayScreen({ tweaks = {} }) {
  const dateLabel = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', weekday: 'long' });

  const sampleLogs = [];
  for (let i = 1; i <= 29; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const s = i % 9 === 0 ? 'skipped' : i % 13 === 0 ? null : 'done';
    if (s) sampleLogs.push({ log_date: d.toISOString().split('T')[0], status: s });
  }

  const [todayStatus, setTodayStatus] = useState(null);
  const [showBanner, setShowBanner]   = useState(true);
  const [showRecovery, setShowRecovery] = useState(false);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, position: 'relative', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl, padding: S.xl }}>

          {/* Zen Focus Header — date + logo mark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, letterSpacing: '0.02rem' }}>{dateLabel}</div>
            <img src="uploads/logo-filled-v2.png" style={{ width: 32, height: 32, objectFit: 'contain', opacity: 0.32 }} />
          </div>

          {/* Focus Card — white floating card */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.xl }}>
            {/* Identity headline — owns the card */}
            <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>
              Become someone who reads daily
            </div>
            {/* Formula */}
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px', letterSpacing: '0.02rem' }}>
              After I brush my teeth, read 1 page
            </div>
            {/* Streak */}
            <IdentityStreakDisplay identityNoun="reader" streak={12} />
            {/* Miss banner */}
            {showBanner && <MissBanner onDismiss={() => setShowBanner(false)} />}
            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
              <PrimaryBtn
                label={todayStatus === 'done' ? 'Done ✓' : 'Done'}
                onClick={() => setTodayStatus('done')}
              />
              <TertiaryBtn
                label={todayStatus === 'skipped' ? 'Skipped ✓' : 'Skip today'}
                onClick={() => setTodayStatus('skipped')}
              />
            </div>
            {/* Heatmap */}
            <Heatmap days={30} logs={sampleLogs} />
          </ZenCard>

          {/* AI insight card */}
          {tweaks.showAIHints !== false && (
            <div style={{ background: GRAD_SUBTLE, borderRadius: R.md, padding: `${S.lg}px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.md }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {Icon.sparkle(C.primary, 17)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: T.micro, fontWeight: 800, color: C.primary, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Insight</div>
                <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>Your consistency is strongest in the morning. Keep the routine going.</div>
              </div>
              {Icon.chevronRight(C.textFaint, 14)}
            </div>
          )}
        </div>
      </div>

      <TabBar active="Today" />

      <RecoveryModal
        visible={showRecovery}
        habitTitle="Reading"
        onRestart={() => setShowRecovery(false)}
        onMakeItSmaller={() => setShowRecovery(false)}
        onPauseForNow={() => setShowRecovery(false)}
        onClose={() => setShowRecovery(false)}
      />
    </div>
  );
}

function TodayEmptyScreen() {
  const dateLabel = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', weekday: 'long' });
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: S.xl, gap: S.xl }}>
        <div style={{ fontSize: T.bodyLg, color: C.textMuted, letterSpacing: '0.02rem' }}>{dateLabel}</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: S.xl }}>
          <ZenCard bg={C.surfaceCard} style={{ gap: S.lg }}>
            <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>No active habits yet</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '28px', letterSpacing: '0.02rem' }}>Start with one Focus habit. Small, repeatable, sized to your worst day.</div>
          </ZenCard>
          <PrimaryBtn label="Create your first habit" onClick={() => {}} />
        </div>
      </div>
      <TabBar active="Today" />
    </div>
  );
}

// ── LIBRARY ──────────────────────────────────────────────────

function LibraryScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: S.xl, position: 'relative' }}>
        {/* Large tonal watermark — felt, not seen */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <img src="uploads/logo-filled-v2.png" style={{ width: 160, height: 160, objectFit: 'contain', opacity: 0.06 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl, position: 'relative' }}>
          <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>Library</div>
          <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '28px', letterSpacing: '0.02rem' }}>
            Your library will grow as habits become part of who you are. The first one usually takes 60–90 days. Stay with it.
          </div>
        </div>
      </div>
      <TabBar active="Library" />
    </div>
  );
}

// ── SETTINGS ─────────────────────────────────────────────────

function SettingsScreen() {
  const archivedHabits = [
    { id: '1', name: 'Meditation',  formula: 'After I wake up, sit quietly for one breath' },
    { id: '2', name: 'Journaling',  formula: 'After dinner, write one sentence' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl, padding: S.xl }}>

          {/* Account */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.sm }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleLg, fontWeight: 700, color: C.text }}>Account</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px' }}>user@example.com</div>
            <div style={{ fontSize: T.bodyMd, color: C.textMuted }}>Trial</div>
          </ZenCard>

          {/* Archived habits */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.lg }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleLg, fontWeight: 700, color: C.text }}>Your archived habits</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px' }}>Pause and resume habits without losing their history.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl }}>
              {archivedHabits.map(h => (
                <div key={h.id} style={{ background: C.surface, borderRadius: R.sm, padding: `${S.lg}px`, display: 'flex', flexDirection: 'column', gap: S.xs, cursor: 'pointer' }}>
                  <div style={{ fontSize: T.micro, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Archived habit</div>
                  <div style={{ fontSize: T.bodyLg, fontWeight: 700, color: C.text }}>{h.name}</div>
                  <div style={{ fontSize: T.bodyMd, color: C.textMuted }}>{h.formula}</div>
                </div>
              ))}
            </div>
          </ZenCard>

          {/* About */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.lg }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleLg, fontWeight: 700, color: C.text }}>About</div>
            {[
              { l: 'Version',          v: '1.0.0',       muted: false },
              { l: 'Privacy Policy',   v: 'Coming soon', muted: true },
              { l: 'Terms of Service', v: 'Coming soon', muted: true },
            ].map(({ l, v, muted }) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, color: muted ? C.textMuted : C.text }}>{l}</span>
                <span style={{ fontSize: 15, color: muted ? C.textFaint : C.text }}>{v}</span>
              </div>
            ))}
          </ZenCard>

          <PrimaryBtn label="Sign Out" onClick={() => {}} />
          <div style={{ height: S.xl }} />
        </div>
      </div>
      <TabBar active="Settings" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// HABIT MANAGEMENT
// ══════════════════════════════════════════════════════════════

function CreateHabitScreen() {
  const [title, setTitle]       = useState('');
  const [identity, setIdentity] = useState('');
  const [cue, setCue]           = useState('');
  const [action, setAction]     = useState('');
  const [mva, setMva]           = useState('');
  const [time, setTime]         = useState('');

  const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Anytime'];
  const hasPreview = cue.trim() && action.trim();
  const preview = hasPreview
    ? `After I ${cue.trim().toLowerCase()}, I will ${action.trim().toLowerCase()}.`
    : 'After I [cue], I will [tiny action].';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl, padding: S.xl }}>
          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
            <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>Create your first habit</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px', letterSpacing: '0.02rem' }}>Keep it concrete, small, and easy to repeat.</div>
          </div>

          {/* Form card */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.xl }}>
            <TextField label="Habit name"                       placeholder="Reading"                        value={title}    onChange={setTitle} />
            <TextField label="Identity phrase"                  placeholder="Become someone who reads daily" value={identity} onChange={setIdentity} />
            <TextField label="Cue"                              placeholder="After I brush my teeth"         value={cue}      onChange={setCue} />
            <TextField label="Tiny action"                      placeholder="Read 1 page"                   value={action}   onChange={setAction} />
            <TextField label="Minimum viable action (optional)" placeholder="Just open the book"            value={mva}      onChange={setMva} />
            <ChoicePills label="Preferred time window" options={TIME_OPTIONS} value={time} onChange={setTime} />
          </ZenCard>

          {/* Preview — tonal, no border */}
          <div style={{ background: C.primarySoft, borderRadius: R.md, padding: `${S.xl}px`, display: 'flex', flexDirection: 'column', gap: S.sm }}>
            <div style={{ fontSize: T.micro, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Preview</div>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: hasPreview ? 600 : 400, color: hasPreview ? C.text : C.textMuted, lineHeight: '28px' }}>{preview}</div>
          </div>

          <PrimaryBtn label="Save Habit" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

function EditHabitScreen() {
  const [title, setTitle]       = useState('Reading');
  const [identity, setIdentity] = useState('someone who reads daily');
  const [cue, setCue]           = useState('brush my teeth');
  const [action, setAction]     = useState('read 1 page');
  const [mva, setMva]           = useState('just open the book');
  const [time, setTime]         = useState('Evening');
  const [rewriteDraft, setRewriteDraft] = useState(null);

  const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Anytime'];
  const preview = `After I ${cue.toLowerCase()}, I will ${action.toLowerCase()}.`;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl, padding: S.xl }}>
          <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>Edit Habit</div>

          {/* Suggestion card — tonal */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.md }}>
            <Eyebrow>Suggested adjustment</Eyebrow>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text }}>Make it smaller</div>
            <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>Reduce the tiny action to something that takes under 2 minutes.</div>
            <div style={{ fontSize: T.labelMd, fontWeight: 700, color: C.text, marginTop: S.xs }}>Why this suggestion</div>
            <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>You've had 4 misses in the last 14 days. Shrinking the action builds reliability first.</div>
            <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px', marginTop: S.xs }}>AI can suggest a rewrite, but you stay in control. It won't change your habit unless you edit and save it.</div>
            <div style={{ marginTop: S.sm }}>
              <SecondaryBtn label={rewriteDraft ? "Generate another rewrite" : "Generate rewrite"} onClick={() => setRewriteDraft({ trigger: 'close my laptop', action: 'read one sentence', why: "A closing-laptop cue is more reliable than toothbrushing for evening readers." })} />
            </div>
            {rewriteDraft && (
              <div style={{ background: C.primarySoft, borderRadius: R.sm, padding: `${S.lg}px`, display: 'flex', flexDirection: 'column', gap: S.sm, marginTop: S.sm }}>
                <div style={{ fontFamily: SERIF, fontSize: T.bodyLg, fontWeight: 700, color: C.text }}>AI rewrite idea</div>
                <Eyebrow color={C.primary}>Trigger</Eyebrow>
                <div style={{ fontSize: T.bodyMd, color: C.text }}>{rewriteDraft.trigger}</div>
                <Eyebrow color={C.primary}>Tiny action</Eyebrow>
                <div style={{ fontSize: T.bodyMd, color: C.text }}>{rewriteDraft.action}</div>
                <Eyebrow color={C.primary}>Why</Eyebrow>
                <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>{rewriteDraft.why}</div>
                <div style={{ marginTop: S.sm }}>
                  <SecondaryBtn label="Copy into fields" onClick={() => { setCue(rewriteDraft.trigger); setAction(rewriteDraft.action); }} />
                </div>
              </div>
            )}
          </ZenCard>

          {/* Form card */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.xl }}>
            <TextField label="Habit name"                       placeholder="Reading"                        value={title}    onChange={setTitle} />
            <TextField label="Identity phrase"                  placeholder="Become someone who reads daily" value={identity} onChange={setIdentity} />
            <TextField label="Cue"                              placeholder="After I brush my teeth"         value={cue}      onChange={setCue} />
            <TextField label="Tiny action"                      placeholder="Read 1 page"                   value={action}   onChange={setAction} />
            <TextField label="Minimum viable action (optional)" placeholder="Just open the book"            value={mva}      onChange={setMva} />
            <ChoicePills label="Preferred time window" options={TIME_OPTIONS} value={time} onChange={setTime} />
          </ZenCard>

          {/* Preview */}
          <div style={{ background: C.primarySoft, borderRadius: R.md, padding: `${S.xl}px`, display: 'flex', flexDirection: 'column', gap: S.sm }}>
            <div style={{ fontSize: T.micro, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Preview</div>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 600, color: C.text, lineHeight: '28px' }}>{preview}</div>
          </div>

          <PrimaryBtn label="Save changes" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

function HabitDetailScreen() {
  const sampleLogs = [];
  for (let i = 1; i <= 89; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const s = i % 7 === 0 ? 'skipped' : i % 11 === 0 ? null : 'done';
    if (s) sampleLogs.push({ log_date: d.toISOString().split('T')[0], status: s });
  }

  const recentLogs = [
    { id: '1', log_date: '2026-04-30', status: 'done',    note: null },
    { id: '2', log_date: '2026-04-29', status: 'done',    note: null },
    { id: '3', log_date: '2026-04-28', status: 'skipped', note: 'Busy day' },
    { id: '4', log_date: '2026-04-27', status: 'done',    note: null },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl, padding: S.xl }}>

          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
            <div style={{ fontSize: T.bodyLg, fontWeight: 700, color: C.primary }}>Become someone who reads daily</div>
            <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>Reading</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px', letterSpacing: '0.02rem' }}>After I brush my teeth, I will read 1 page.</div>
          </div>

          {/* Setup */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.lg }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text }}>Setup</div>
            <RowLV label="Identity"        value="Become someone who reads daily" />
            <RowLV label="Formula"         value="After I brush my teeth, I will read 1 page." />
            <RowLV label="Preferred time"  value="Evening" />
          </ZenCard>

          {/* Heatmap */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.md }}>
            <Heatmap days={90} logs={sampleLogs} />
          </ZenCard>

          {/* Today */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.sm }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text }}>Today</div>
            <div style={{ fontSize: T.titleMd, fontWeight: 600, color: C.text }}>Today not logged yet</div>
          </ZenCard>

          {/* Progress */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.lg }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text }}>Progress</div>
            <IdentityStreakDisplay identityNoun="reader" streak={12} />
            <div style={{ display: 'flex', gap: S.lg, flexWrap: 'wrap' }}>
              {[{ l: '30-day skips', v: '2' }, { l: 'Consistency', v: '84%' }].map(({ l, v }) => (
                <div key={l} style={{ background: C.surface, borderRadius: R.sm, padding: `${S.md}px ${S.lg}px`, display: 'flex', flexDirection: 'column', gap: S.xs, flex: 1 }}>
                  <div style={{ fontSize: T.micro, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                  <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text }}>{v}</div>
                </div>
              ))}
            </div>
          </ZenCard>

          {/* Recent history — no dividers, vertical space */}
          <ZenCard bg={C.surfaceCard} style={{ gap: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text, marginBottom: S.xl }}>Recent history</div>
            {recentLogs.map((log, i) => (
              <div key={log.id} style={{ paddingTop: i > 0 ? S.xl : 0, paddingBottom: S.xl }}>
                <div style={{ fontSize: T.bodyLg, fontWeight: 600, color: C.text }}>
                  {new Date(`${log.log_date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} — {log.status === 'done' ? 'Done' : 'Skipped'}
                </div>
                {log.note && <div style={{ fontSize: T.bodyMd, color: C.textMuted, marginTop: S.xs }}>{log.note}</div>}
              </div>
            ))}
          </ZenCard>

          {/* Weekly review */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.lg }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text }}>Latest weekly review</div>
            <div style={{ fontSize: T.bodyMd, fontWeight: 600, color: C.textMuted }}>Week of 28 Apr</div>
            <RowLV label="What went well"       value="Morning sessions were easy. The habit fires reliably after coffee." />
            <RowLV label="What was hard"        value="Evening sessions on busy days." />
            <RowLV label="Trigger worked"       value="Yes" />
            <RowLV label="Tiny action too hard" value="No" />
            <SecondaryBtn label="Update weekly review" onClick={() => {}} />
          </ZenCard>

          {/* Suggestion */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.md }}>
            <Eyebrow>Suggested adjustment</Eyebrow>
            <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text }}>Make it smaller</div>
            <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>Try reading just one sentence. The goal is to show up, not to cover ground.</div>
            <div style={{ fontSize: T.labelMd, fontWeight: 700, color: C.text }}>Why this suggestion</div>
            <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>4 misses in 14 days suggests the current action size creates friction.</div>
            <SecondaryBtn label="Review suggestion" onClick={() => {}} />
          </ZenCard>

          {/* Archive */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
            <div style={{ background: C.surfaceCard, borderRadius: R.md, padding: `${S.xl}px`, boxShadow: SHADOW_LIFT, display: 'flex', flexDirection: 'column', gap: S.xs }}>
              <div style={{ fontFamily: SERIF, fontSize: T.bodyLg, fontWeight: 700, color: C.text }}>Archive habit</div>
              <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>This removes the habit from Today, but keeps its history.</div>
            </div>
            <SecondaryBtn label="Archive habit" onClick={() => {}} />
            <SecondaryBtn label="Edit habit"    onClick={() => {}} />
            <TertiaryBtn  label="Back to Today" onClick={() => {}} />
          </div>
          <div style={{ height: S.xl }} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// WEEKLY REVIEW
// ══════════════════════════════════════════════════════════════

function WeeklyReviewScreen() {
  const [wentWell, setWentWell]   = useState('');
  const [wasHard, setWasHard]     = useState('');
  const [adjNote, setAdjNote]     = useState('');
  const [triggerWorked, setTriggerWorked] = useState(null);
  const [tooHard, setTooHard]     = useState(null);
  const [saved, setSaved]         = useState(false);
  const [valError, setValError]   = useState(null);

  function handleSave() {
    if (triggerWorked === null || tooHard === null) { setValError('Answer both yes/no questions before saving.'); return; }
    setValError(null); setSaved(true);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl, padding: S.xl }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
            <div style={{ fontFamily: SERIF, fontSize: T.headlineLg, fontWeight: 800, color: C.text, lineHeight: '36px' }}>Weekly Review</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted, lineHeight: '26px', letterSpacing: '0.02rem' }}>Take one minute to notice what worked and what needs adjusting.</div>
          </div>

          {/* Habit name card */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.sm }}>
            <div style={{ fontFamily: SERIF, fontSize: T.titleLg, fontWeight: 700, color: C.text }}>Reading</div>
            <div style={{ fontSize: T.bodyLg, color: C.textMuted }}>Week of Apr 28</div>
          </ZenCard>

          {/* Validation error */}
          {valError && (
            <div style={{ background: '#fdf2f2', borderRadius: R.sm, padding: `${S.md}px ${S.lg}px`, fontSize: T.bodyMd, color: C.danger, lineHeight: '20px' }}>{valError}</div>
          )}

          {/* Form */}
          <ZenCard bg={C.surfaceCard} style={{ gap: S.xxl }}>
            <TextField label="What went well this week?" placeholder="The moment that felt easiest" value={wentWell} onChange={setWentWell} multiline />
            <TextField label="What was hard this week?"  placeholder="The part that got in the way"  value={wasHard}  onChange={setWasHard}  multiline />
            <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>These answers help the app suggest what to adjust next week.</div>
            <NullableBooleanField label="Did your trigger work?"        value={triggerWorked} onChange={setTriggerWorked} />
            <NullableBooleanField label="Was the tiny action too hard?" value={tooHard}        onChange={setTooHard} />
            <TextField label="What small adjustment do you want to try next week?" placeholder="One small change for next week" value={adjNote} onChange={setAdjNote} multiline />
          </ZenCard>

          {/* Success state */}
          {saved && (
            <ZenCard bg={C.surfaceCard} style={{ gap: S.xs, borderLeft: `3px solid ${C.success}` }}>
              <div style={{ fontSize: T.bodyLg, fontWeight: 700, color: C.success }}>Review saved</div>
              <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>Your habit reflection has been updated for this week.</div>
            </ZenCard>
          )}

          {/* Suggestion post-save */}
          {saved && (
            <ZenCard bg={C.surfaceCard} style={{ gap: S.md }}>
              <Eyebrow>Suggested adjustment</Eyebrow>
              <div style={{ fontFamily: SERIF, fontSize: T.titleMd, fontWeight: 700, color: C.text }}>Make it smaller</div>
              <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>Your trigger wobbles on busy days. Try shrinking the action to a single breath this week.</div>
              <div style={{ fontSize: T.labelMd, fontWeight: 700, color: C.text }}>Why this suggestion</div>
              <div style={{ fontSize: T.bodyMd, color: C.textMuted, lineHeight: '20px' }}>The tiny action may still be slightly too large for your hardest days.</div>
            </ZenCard>
          )}

          <PrimaryBtn label={saved ? "Saved ✓" : "Save weekly review"} onClick={handleSave} disabled={saved} />
          <div style={{ height: S.xl }} />
        </div>
      </div>
    </div>
  );
}

// ── Recovery Modal Screen ─────────────────────────────────────
function RecoveryModalScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: SANS, position: 'relative', overflow: 'hidden' }}>
      <TodayScreen tweaks={{ showAIHints: false }} />
      <RecoveryModal
        visible={true}
        habitTitle="Reading"
        onRestart={() => {}}
        onMakeItSmaller={() => {}}
        onPauseForNow={() => {}}
        onClose={() => {}}
      />
    </div>
  );
}

// ── Export all screens to window ─────────────────────────────
Object.assign(window, {
  // Auth
  SignInScreen,
  SignUpScreen,
  // Onboarding
  OnboardingWelcomeScreen,
  OnboardingBecomingScreen,
  OnboardingDailyActionScreen,
  OnboardingShrinkScreen,
  OnboardingWorstDayScreen,
  OnboardingCueScreen,
  OnboardingConfirmationScreen,
  // Core
  TodayScreen,
  TodayEmptyScreen,
  LibraryScreen,
  SettingsScreen,
  // Habits
  CreateHabitScreen,
  EditHabitScreen,
  HabitDetailScreen,
  WeeklyReviewScreen,
  // Modals
  RecoveryModalScreen,
});
