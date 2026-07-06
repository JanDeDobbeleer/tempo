import type { FC } from 'react'

/**
 * Custom stopwatch icon for the punch-in action.
 * SVG-based so it aligns precisely at any size and inherits currentColor.
 */
const PunchIcon: FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
  >
    {/* Circular stopwatch body */}
    <circle cx="12" cy="13" r="7" />
    {/* Crown stem */}
    <path d="M12 6V4.5" />
    {/* Crown cap */}
    <path d="M9.5 4.5h5" />
    {/* Side start/lap button */}
    <path d="M17.5 8l1.5-1.5" />
    {/* Single hand pointing straight up — 12 o'clock start position */}
    <path d="M12 13V9.5" />
  </svg>
)

export default PunchIcon
