import { useState } from 'react';
import { Bot } from 'lucide-react';

interface LarsAvatarProps {
  className?: string;
  sizeClass?: string;
  alt?: string;
}

export function LarsAvatar({
  className = '',
  sizeClass = 'w-12 h-12',
  alt = 'Lars — vært og terningmodstander',
}: LarsAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-gradient-to-br from-sky-600 to-blue-900 flex items-center justify-center text-white font-display font-bold border border-white/20 shrink-0 ${className}`}
        aria-label={alt}
      >
        <Bot className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <img
      src="/assets/aistudio/lars_47c49d6d.png"
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover object-top shrink-0 ${className}`}
    />
  );
}

interface PlayerAvatarProps {
  name: string;
  isLars?: boolean;
  avatarColor: string;
  sizeClass?: string;
  className?: string;
}

export function PlayerAvatar({
  name,
  isLars,
  avatarColor,
  sizeClass = 'w-10 h-10',
  className = '',
}: PlayerAvatarProps) {
  if (isLars) {
    return <LarsAvatar sizeClass={sizeClass} className={className} alt={`${name} (AI)`} />;
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'S';

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-display font-bold text-white shadow-inner shrink-0 select-none ${className}`}
      style={{ backgroundColor: avatarColor }}
      aria-hidden="true"
    >
      <span className="text-sm leading-none">{initials}</span>
    </div>
  );
}
