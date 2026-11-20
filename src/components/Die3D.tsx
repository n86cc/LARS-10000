import { memo } from 'react';
import type { DieValue } from '../types/game';

interface Die3DProps {
  dieId?: number;
  value: DieValue;
  size?: 'sm' | 'md' | 'lg';
  isScoring?: boolean;
  isSelected?: boolean;
  isLocked?: boolean;
  isDimmed?: boolean;
  rollNonce?: number;
  staggerIndex?: number;
  disabled?: boolean;
  isInteractive?: boolean;
  onSelect?: (dieId: number) => void;
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

export const Die3D = memo(function Die3D({
  dieId,
  value,
  size = 'lg',
  isScoring = false,
  isSelected = false,
  isLocked = false,
  isDimmed = false,
  rollNonce = 0,
  staggerIndex = 0,
  disabled = false,
  isInteractive = false,
  onSelect,
  onClick,
  ariaLabel,
}: Die3DProps) {
  const sizeClasses =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : size === 'md'
        ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-xl'
        : 'w-15 h-15 sm:w-20 sm:h-20 rounded-2xl';

  const pipRadius = size === 'sm' ? 8.5 : 8;
  const pips = PIP_POSITIONS[value];

  const baseSurface = isLocked
    ? 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-200 dark:to-slate-300 border border-slate-300/90 shadow-sm'
    : 'bg-gradient-to-br from-white via-slate-50 to-slate-200 border border-white/90 shadow-[0_8px_18px_rgba(2,12,27,0.32),inset_0_-3px_0_rgba(148,163,184,0.42)]';

  const stateClasses = isSelected
    ? '-translate-y-2 scale-[1.04] ring-3 ring-amber-400 shadow-[0_12px_24px_rgba(245,158,11,0.38)]'
    : isScoring && !isLocked
      ? 'scoring-die-glow ring-2 ring-sky-300 dark:ring-sky-300/90 hover:-translate-y-1'
      : isDimmed
        ? 'opacity-65'
        : 'hover:-translate-y-0.5';

  const canClick = Boolean((onSelect && dieId !== undefined) || onClick);
  const interactiveClasses =
    canClick && !disabled
      ? 'cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-amber-400'
      : 'cursor-default';

  const content = (
    <svg viewBox="0 0 100 100" className="w-full h-full block" aria-hidden="true">
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

  const handlePress = () => {
    if (disabled) return;
    if (onSelect && dieId !== undefined) {
      onSelect(dieId);
    } else if (onClick) {
      onClick();
    }
  };

  if (isInteractive || canClick) {
    return (
      <button
        key={`${rollNonce}-${value}`}
        type="button"
        onClick={handlePress}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={ariaLabel ?? `Terning ${value}${isSelected ? ' (valgt)' : ''}`}
        style={
          rollNonce > 0
            ? { animationDelay: `${staggerIndex * 16}ms` }
            : undefined
        }
        className={`relative select-none transition-transform duration-125 ease-out ${sizeClasses} ${baseSurface} ${stateClasses} ${interactiveClasses} ${
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
});
