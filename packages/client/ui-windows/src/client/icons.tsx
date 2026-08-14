/**
 * Line-art SVG glyphs for the desktop chrome (window controls, taskbar).
 * Inline SVG instead of text glyphs so they scale crisply, follow
 * currentColor, and never render as system emoji.
 */

/** Shared 12x12 canvas sizing for the window-control glyphs. */
const controlViewBox = { width: 12, height: 12, viewBox: '0 0 12 12' } as const

/** The minimize control: a low horizontal bar. */
export function IconMinimize() {
  return (
    <svg {...controlViewBox} aria-hidden="true" focusable="false">
      <path d="M2.5 8.5h7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** The maximize control: a rounded square outline. */
export function IconMaximize() {
  return (
    <svg {...controlViewBox} aria-hidden="true" focusable="false">
      <rect x="2.4" y="2.4" width="7.2" height="7.2" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

/** The restore control (maximized): a front square under a tucked-back one. */
export function IconRestore() {
  return (
    <svg {...controlViewBox} aria-hidden="true" focusable="false">
      <rect x="1.8" y="4.2" width="6" height="6" rx="1.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.6 3.4V3A1.2 1.2 0 0 1 5.8 1.8H9A1.2 1.2 0 0 1 10.2 3v3.2A1.2 1.2 0 0 1 9 7.4h-.4"
        fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
      />
    </svg>
  )
}

/** The close control: a diagonal cross. */
export function IconClose() {
  return (
    <svg {...controlViewBox} aria-hidden="true" focusable="false">
      <path
        d="M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8"
        fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
      />
    </svg>
  )
}

/** The taskbar's sidebar-toggle control: a 2x2 square grid. */
export function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <rect x="1.5" y="1.5" width="4.6" height="4.6" rx="1" />
        <rect x="7.9" y="1.5" width="4.6" height="4.6" rx="1" />
        <rect x="1.5" y="7.9" width="4.6" height="4.6" rx="1" />
        <rect x="7.9" y="7.9" width="4.6" height="4.6" rx="1" />
      </g>
    </svg>
  )
}
