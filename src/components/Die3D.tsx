import type { DieValue } from '../types/game';

interface Die3DProps {
  value: DieValue;
  size?: 'sm' | 'md' | 'lg';
  isScoring?: boolean;
  isSelected?: boolean;
  isLocked?: boolean;
  isDimmed?: boolean;
  rollNonce?: number;
  staggerIndex?: number;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

const PIP_POSITIONS: Record<DieValue, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 25],
    [72, 25],
    [28, 50],
    [72, 50],
    [28, 75],
    [72, 75],
  ],
};

export function Die3D({
  value,
  size = 'lg',
  isScoring = false,
  isSelected = false,
  isLocked = false,
  isDimmed = false,
  rollNonce = 0,
  staggerIndex = 0,
  disabled = false,
  onClick,
  ariaLabel,
}: Die3DProps) {
  const sizeClasses =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : size === 'md'
        ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-xl'
        : 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl';

  const pipRadius = size === 'sm' ? 8.5 : 8;
  const pips = PIP_POSITIONS[value];

  const baseSurface = isLocked
    ? 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-200 dark:to-slate-300 border border-slate-300/90 shadow-sm'
    : 'bg-gradient-to-br from-white via-slate-50 to-slate-200 border border-white/90 shadow-[0_8px_20px_rgba(2,12,27,0.35),inset_0_-3px_0_rgba(148,163,184,0.45)]';

  const stateClasses = isSelected
    ? '-translate-y-2 scale-[1.04] ring-3 ring-amber-400 shadow-[0_14px_28px_rgba(245,158,11,0.38)]'
    : isScoring && !isLocked
      ? 'scoring-die-glow ring-2 ring-sky-300 dark:ring-sky-300/90 hover:-translate-y-1'
      : isDimmed
        ? 'opacity-65'
        : 'hover:-translate-y-0.5';

  const interactiveClasses =
    onClick && !disabled
      ? 'cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-amber-400'
      : 'cursor-default';

  const content = (
    <svg viewBox="0 0 100 100" className="w-full h-full block" aria-hidden="true">
      <defs>
        <radialGradient id={`dieGloss-${size}`} cx="30%" cy="22%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect x="3" y="3" width="94" height="94" rx="18" fill={`url(#dieGloss-${size})`} />
      {pips.map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r={pipRadius}
          fill={value === 1 ? '#dc2626' : '#0f172a'}
        />
      ))}
    </svg>
  );

  const animationKey = `${rollNonce}-${value}`;

  if (onClick) {
    return (
      <button
        key={animationKey}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={ariaLabel ?? `Terning ${value}${isSelected ? ' (valgt)' : ''}`}
        style={
          rollNonce > 0
            ? { animationDelay: `${staggerIndex * 35}ms` }
            : undefined
        }
        className={`relative select-none transition-transform duration-150 ease-out ${sizeClasses} ${baseSurface} ${stateClasses} ${interactiveClasses} ${
          rollNonce > 0 ? 'animate-dice-tumble' : ''
        }`}
      >
        {content}
        {isSelected && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-mono text-[11px] font-bold flex items-center justify-center shadow"
          >
            ✓
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`relative select-none ${sizeClasses} ${baseSurface} ${
        isDimmed ? 'opacity-65' : ''
      }`}
      aria-label={ariaLabel ?? `Terning ${value}`}
    >
      {content}
    </div>
  );
}
