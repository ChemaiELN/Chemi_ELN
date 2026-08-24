import { useId } from 'react';
import './BrandSpinner.css';

/** Laurus brand colors, sampled from src/assets/logo.svg (the deep purple and green in the mark). */
const PURPLE = '#42145F';
const GREEN = '#69BE28';

/**
 * A lemniscate (∞) infinity-symbol path traced in the brand's two colors
 * instead of a generic ring spinner.
 */
const INFINITY_PATH =
  'M 106 32 L 105.96 33.8 L 105.86 35.6 L 105.68 37.37 L 105.43 39.11 L 105.12 40.8 L 104.73 42.44 L 104.27 44.02 L 103.75 45.52 L 103.16 46.94 L 102.5 48.26 L 101.77 49.49 L 100.99 50.61 L 100.13 51.61 L 99.22 52.49 L 98.25 53.25 L 97.21 53.87 L 96.12 54.36 L 94.98 54.72 L 93.78 54.93 L 92.53 55 L 91.22 54.93 L 89.87 54.72 L 88.48 54.36 L 87.04 53.87 L 85.56 53.25 L 84.03 52.49 L 82.48 51.61 L 80.88 50.61 L 79.26 49.49 L 77.6 48.26 L 75.92 46.94 L 74.21 45.52 L 72.49 44.02 L 70.74 42.44 L 68.97 40.8 L 67.2 39.11 L 65.41 37.37 L 63.61 35.6 L 61.81 33.8 L 60 32 L 58.19 30.2 L 56.39 28.4 L 54.59 26.63 L 52.8 24.89 L 51.03 23.2 L 49.26 21.56 L 47.51 19.98 L 45.79 18.48 L 44.08 17.06 L 42.4 15.74 L 40.74 14.51 L 39.12 13.39 L 37.52 12.39 L 35.97 11.51 L 34.44 10.75 L 32.96 10.13 L 31.52 9.64 L 30.13 9.28 L 28.78 9.07 L 27.47 9 L 26.22 9.07 L 25.02 9.28 L 23.88 9.64 L 22.79 10.13 L 21.75 10.75 L 20.78 11.51 L 19.87 12.39 L 19.01 13.39 L 18.23 14.51 L 17.5 15.74 L 16.84 17.06 L 16.25 18.48 L 15.73 19.98 L 15.27 21.56 L 14.88 23.2 L 14.57 24.89 L 14.32 26.63 L 14.14 28.4 L 14.04 30.2 L 14 32 L 14.04 33.8 L 14.14 35.6 L 14.32 37.37 L 14.57 39.11 L 14.88 40.8 L 15.27 42.44 L 15.73 44.02 L 16.25 45.52 L 16.84 46.94 L 17.5 48.26 L 18.23 49.49 L 19.01 50.61 L 19.87 51.61 L 20.78 52.49 L 21.75 53.25 L 22.79 53.87 L 23.88 54.36 L 25.02 54.72 L 26.22 54.93 L 27.47 55 L 28.78 54.93 L 30.13 54.72 L 31.52 54.36 L 32.96 53.87 L 34.44 53.25 L 35.97 52.49 L 37.52 51.61 L 39.12 50.61 L 40.74 49.49 L 42.4 48.26 L 44.08 46.94 L 45.79 45.52 L 47.51 44.02 L 49.26 42.44 L 51.03 40.8 L 52.8 39.11 L 54.59 37.37 L 56.39 35.6 L 58.19 33.8 L 60 32 L 61.81 30.2 L 63.61 28.4 L 65.41 26.63 L 67.2 24.89 L 68.97 23.2 L 70.74 21.56 L 72.49 19.98 L 74.21 18.48 L 75.92 17.06 L 77.6 15.74 L 79.26 14.51 L 80.88 13.39 L 82.48 12.39 L 84.03 11.51 L 85.56 10.75 L 87.04 10.13 L 88.48 9.64 L 89.87 9.28 L 91.22 9.07 L 92.53 9 L 93.78 9.07 L 94.98 9.28 L 96.12 9.64 L 97.21 10.13 L 98.25 10.75 L 99.22 11.51 L 100.13 12.39 L 100.99 13.39 L 101.77 14.51 L 102.5 15.74 L 103.16 17.06 L 103.75 18.48 L 104.27 19.98 L 104.73 21.56 L 105.12 23.2 L 105.43 24.89 L 105.68 26.63 L 105.86 28.4 L 105.96 30.2 L 106 32 Z';

interface Props {
  /** Pixel width; height follows the 120x64 viewBox aspect ratio. */
  size?: number;
  /** Optional caption rendered under the mark. */
  label?: string;
  className?: string;
  /**
   * When true (default), the spinner centers itself over the whole viewport
   * regardless of where it's mounted in the tree — the caller never has to
   * wrap it in a centering container. Set false to center only within its
   * immediate parent (e.g. a card or panel with its own fixed size).
   */
  fullScreen?: boolean;
}

/**
 * Laurus-branded loading indicator: the infinity mark traced endlessly in
 * the brand's purple → green gradient (sampled from src/assets/logo.svg).
 * Always renders centered — either on the full screen (default) or within
 * its parent — so it never needs a bespoke centering wrapper at each call site.
 */
export default function BrandSpinner({ size = 96, label, className, fullScreen = true }: Props) {
  const gradientId = `brand-spinner-gradient-${useId()}`;

  return (
    <div
      className={`brand-spinner ${fullScreen ? 'brand-spinner-fullscreen' : 'brand-spinner-inline'} ${className ?? ''}`}
    >
      <svg
        width={size}
        height={(size * 64) / 120}
        viewBox="0 0 120 64"
        fill="none"
        role="status"
        aria-label={label ?? 'Loading'}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PURPLE} />
            <stop offset="48%" stopColor={PURPLE} />
            <stop offset="58%" stopColor={GREEN} />
            <stop offset="100%" stopColor={GREEN} />
          </linearGradient>
        </defs>

        {/* Static faint track — always shows the full infinity outline. */}
        <path
          d={INFINITY_PATH}
          pathLength={100}
          stroke="var(--surface-300, #d8dce6)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Animated brand-colored segment, looping the infinity path forever. */}
        <path
          className="brand-spinner-trace"
          d={INFINITY_PATH}
          pathLength={100}
          stroke={`url(#${gradientId})`}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label && <span className="brand-spinner-label">{label}</span>}
    </div>
  );
}
