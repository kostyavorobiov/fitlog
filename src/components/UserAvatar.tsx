import React, { useState, useEffect } from 'react';

export interface UserAvatarProps {
  src?: string | null;
  image?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  title?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-20 h-20 text-xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  image,
  alt,
  name,
  size = 'md',
  className = '',
  onClick,
  title,
}) => {
  const [imgError, setImgError] = useState(false);
  const resolvedSrc = src || image;
  const resolvedAlt = alt || name || 'Користувач';

  // Reset error if src prop changes
  useEffect(() => {
    setImgError(false);
  }, [resolvedSrc]);

  const hasValidImage = Boolean(resolvedSrc && !imgError && typeof resolvedSrc === 'string' && resolvedSrc.trim().length > 0);

  return (
    <div
      onClick={onClick}
      title={title || alt}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden transition-all ${
        sizeClasses[size]
      } ${
        onClick ? 'cursor-pointer hover:ring-2 hover:ring-[#2563EB] dark:hover:ring-[#60A5FA] focus:outline-none focus:ring-2 focus:ring-[#2563EB]' : ''
      } ${className}`}
    >
      {hasValidImage ? (
        <img
          src={resolvedSrc!}
          alt={resolvedAlt}
          onError={() => setImgError(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        /* Default Avatar: WD adapting to active theme */
        <div
          className="h-full w-full rounded-full flex items-center justify-center font-bold tracking-tight border transition-colors bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] border-[#2563EB]/25"
        >
          <span>WD</span>
        </div>
      )}
    </div>
  );
};
