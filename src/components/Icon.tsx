import type { ReactElement } from 'react'

export type IconName =
  | 'calc'
  | 'flask'
  | 'sigma'
  | 'plot'
  | 'sqrt'
  | 'book'
  | 'sliders'
  | 'more'
  | 'close'
  | 'copy'
  | 'check'
  | 'star'
  | 'clock'
  | 'trash'
  | 'undo'
  | 'redo'
  | 'backspace'
  | 'plus'
  | 'chevron-down'

const PATHS: Record<IconName, ReactElement> = {
  calc: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <line x1="8.5" y1="6.5" x2="15.5" y2="6.5" />
      <circle cx="9" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  flask: (
    <>
      <path d="M10 2.5v5.8L4.6 18a2 2 0 0 0 1.8 3h11.2a2 2 0 0 0 1.8-3L14 8.3V2.5" />
      <line x1="8.5" y1="2.5" x2="15.5" y2="2.5" />
      <line x1="7.5" y1="14" x2="16.5" y2="14" />
    </>
  ),
  sigma: (
    <>
      <path d="M17 5H7l6 7-6 7h10" />
    </>
  ),
  plot: (
    <>
      <path d="M3.5 3v17.5H21" />
      <path d="M6.5 16.5c3-9 5.5-9 8.5-4s4.5 3.5 6-1.5" />
    </>
  ),
  sqrt: (
    <>
      <path d="M2.5 13.5l2.8 5.5L10 5.5h11.5" />
      <line x1="13" y1="19" x2="21.5" y2="19" opacity="0" />
    </>
  ),
  book: (
    <>
      <path d="M2.5 4h5.5a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3h-6.5z" />
      <path d="M21.5 4h-5.5a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h6.5z" />
    </>
  ),
  sliders: (
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <circle cx="15" cy="6" r="2.4" fill="var(--panel)" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="8" cy="12" r="2.4" fill="var(--panel)" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="13" cy="18" r="2.4" fill="var(--panel)" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  check: (
    <>
      <path d="M20 6L9 17l-5-5" />
    </>
  ),
  star: (
    <>
      <path d="M12 2.8l3 6.1 6.7 1-4.85 4.72 1.15 6.68L12 18.15l-6 3.15 1.15-6.68L2.3 9.9l6.7-1z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5V12l3.5 2" />
    </>
  ),
  trash: (
    <>
      <path d="M3.5 6.5h17" />
      <path d="M8.5 6.5V4.8A1.8 1.8 0 0 1 10.3 3h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7" />
      <path d="M5.5 6.5l1 13a2 2 0 0 0 2 1.9h7a2 2 0 0 0 2-1.9l1-13" />
    </>
  ),
  undo: (
    <>
      <path d="M3.5 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.7L3.5 13" />
    </>
  ),
  redo: (
    <>
      <path d="M20.5 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 15-6.7l2.5 2.7" />
    </>
  ),
  backspace: (
    <>
      <path d="M21 4.5H8.6L2 12l6.6 7.5H21a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 21 4.5z" />
      <line x1="11.5" y1="9.5" x2="16.5" y2="14.5" />
      <line x1="16.5" y1="9.5" x2="11.5" y2="14.5" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  'chevron-down': (
    <>
      <path d="M6 9.5l6 6 6-6" />
    </>
  ),
}

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
}

export default function Icon({ name, size = 20, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#3d52e8" />
      <path
        d="M43 19H23l11 13-11 13h20"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
