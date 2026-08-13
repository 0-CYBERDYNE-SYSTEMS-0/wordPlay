import React from 'react';

/**
 * MatteDots — low-profile, elite processing indicator.
 *
 * A tight constellation of matte dots in the editorial palette (copper, teal,
 * sand) with a staggered breathing pulse. Designed to read as "quietly at
 * work" rather than a loud spinner. Used across the header, popups, and the
 * editor save status so every processing state in the UI shares one visual
 * language.
 *
 * Props:
 * - size: diameter of each dot (default 4px)
 * - gap: spacing between dots (default 4px)
 * - speed: animation duration in ms (default 1400)
 * - dotCount: number of dots (default 4)
 * - label: optional sr-only text for screen readers
 * - active: when false, renders static dots (no pulse) — e.g. "saved" state
 */
interface MatteDotsProps {
  size?: number;
  gap?: number;
  speed?: number;
  dotCount?: number;
  label?: string;
  active?: boolean;
  className?: string;
}

const DOT_COLORS = [
  'var(--wp-copper)',   // copper — primary accent
  'var(--wp-teal)',     // teal — secondary accent
  'color-mix(in srgb, var(--wp-ink) 55%, var(--wp-copper) 45%)', // warm sand
  'var(--wp-copper)',
  'color-mix(in srgb, var(--wp-teal) 70%, var(--wp-copper) 30%)',
];

export default function MatteDots({
  size = 4,
  gap = 4,
  speed = 1400,
  dotCount = 4,
  label,
  active = true,
  className = '',
}: MatteDotsProps) {
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: `${gap}px` }}
      role="status"
      aria-label={label || (active ? 'Processing' : undefined)}
      aria-live="polite"
    >
      {Array.from({ length: dotCount }).map((_, i) => (
        <span
          key={i}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '9999px',
            background: DOT_COLORS[i % DOT_COLORS.length],
            // Matte finish: subtle desaturation via soft alpha + faint ring
            boxShadow: active
              ? `0 0 ${size * 0.8}px color-mix(in srgb, ${DOT_COLORS[i % DOT_COLORS.length]} 40%, transparent)`
              : 'inset 0 0 0 1px color-mix(in srgb, var(--wp-ink) 15%, transparent)',
            opacity: active ? 0.85 : 0.45,
            animation: active ? `matte-dot-pulse ${speed}ms ease-in-out ${(i * speed) / dotCount / 2}ms infinite` : undefined,
          }}
        />
      ))}
      <style>{`
        @keyframes matte-dot-pulse {
          0%, 100% { transform: scale(0.75); opacity: 0.45; }
          50% { transform: scale(1); opacity: 0.95; }
        }
      `}</style>
    </span>
  );
}
