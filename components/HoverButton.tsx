'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

/**
 * HoverButton — a thin wrapper that swaps inline styles on hover without
 * triggering React re-renders from pointer events.  Replaces the repeated
 * onMouseEnter / onMouseLeave pattern scattered across the codebase.
 *
 * Usage:
 *   <HoverButton
 *     base={{ color: 'var(--text-muted)', borderColor: 'var(--border-mid)' }}
 *     hover={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
 *     className="font-['DM_Mono'] text-xs px-2 py-1 rounded-md border cursor-pointer"
 *     onClick={handler}
 *   >
 *     Delete
 *   </HoverButton>
 */

interface HoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Styles applied in the resting (non-hovered) state. */
  base?: CSSProperties;
  /** Styles merged in on hover. Reverts to `base` on mouse-leave. */
  hover?: CSSProperties;
  children?: ReactNode;
}

export function HoverButton({
  base = {},
  hover = {},
  style,
  onMouseEnter,
  onMouseLeave,
  children,
  ...rest
}: HoverButtonProps) {
  const [hovered, setHovered] = useState(false);

  const merged: CSSProperties = hovered
    ? { ...base, ...hover, ...style }
    : { ...base, ...style };

  return (
    <button
      style={merged}
      onMouseEnter={e => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={e => { setHovered(false); onMouseLeave?.(e); }}
      {...rest}
    >
      {children}
    </button>
  );
}

HoverButton.displayName = 'HoverButton';
