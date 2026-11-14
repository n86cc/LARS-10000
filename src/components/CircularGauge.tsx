interface CircularGaugeProps {
  currentValue: number;
  targetValue: number;
  label: string;
}

export function CircularGauge({ currentValue, targetValue, label }: CircularGaugeProps) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(1, Math.max(0, currentValue / Math.max(1, targetValue)));
  const dashOffset = circumference * (1 - ratio);
  const reached = currentValue >= targetValue;

  // 24 subtle radial tick marks around the dial like farkle.png
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90" aria-hidden="true">
          {ticks.map((deg) => (
            <line
              key={deg}
              x1="56"
              y1="5"
              x2="56"
              y2="9"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-slate-400/40 dark:text-sky-200/25"
              transform={`rotate(${deg} 56 56)`}
            />
          ))}
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-slate-200/80 dark:text-sky-950/80"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`transition-all duration-300 ease-out ${
              reached ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'
            }`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <span className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white leading-tight">
            {currentValue.toLocaleString('da-DK')}
          </span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-sky-200/70">
            / {targetValue.toLocaleString('da-DK')}
          </span>
        </div>
      </div>
      <span className="mt-1 text-xs font-medium text-slate-600 dark:text-sky-100/80">
        {label}
      </span>
    </div>
  );
}
