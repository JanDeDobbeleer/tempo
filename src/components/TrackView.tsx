import type { CSSProperties, FC } from 'react'
import type { TrackViewProps } from '../types'

const heatmapNavButtonStyle: CSSProperties = {
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: '#9ca3af',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: 1,
  borderRadius: '5px',
}

const TrackView: FC<TrackViewProps> = ({ days, weekSummary, monthHeatmap, accent }) => {
  return (
    <div className="track-view-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', background: '#ffffff', borderRight: '1px solid #e9ebef' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '22px 22px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {days.map((day) => (
            <section key={day.iso}>
              <header
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '10px',
                  paddingBottom: '9px',
                  borderBottom: '1px solid #eef0f3',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
                  <span style={day.numStyle}>{day.dayNum}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{day.dowLabel}</span>
                </div>
                {day.totalHoursLabel && (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', fontFamily: "'Geist Mono',monospace" }}>
                    {day.totalHoursLabel}
                  </span>
                )}
              </header>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {day.entries.map((row) => (
                  <div
                    key={row.id}
                    className="day-list-row"
                    style={{
                      display: 'flex',
                      gap: '11px',
                      padding: '11px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: '1px solid #eef0f3',
                      background: '#fff',
                    }}
                    onClick={row.onClick}
                  >
                    <div style={row.dotStyle}></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {row.projectName}
                      </div>
                      {row.comment && (
                        <div style={{ fontSize: '12px', color: '#8a909a', marginTop: '3px', lineHeight: 1.35 }}>
                          {row.comment}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>
                        {row.hoursLabel}
                      </div>
                      <div style={{ fontSize: '12px', color: accent, fontFamily: "'Geist Mono',monospace", marginTop: '2px' }}>
                        {row.earnLabel}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="track-add-entry"
                  onClick={day.onAddEntry}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: '1px dashed #d7dadf',
                    background: 'transparent',
                    color: '#9ca3af',
                    fontSize: '13px',
                    fontWeight: 500,
                    textAlign: 'left',
                  }}
                >
                  + Add entry
                </button>
              </div>
            </section>
          ))}
        </div>
      </div>

      <aside
        className="track-view-aside"
        style={{
          width: '312px',
          flexShrink: 0,
          background: '#fbfcfd',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid #eef0f3' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#9ca3af',
              fontFamily: "'Geist Mono',monospace",
            }}
          >
            Week total · {weekSummary.weekLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '7px' }}>
            <span style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em' }}>{weekSummary.hoursLabel}</span>
            <span style={{ fontSize: '14px', color: '#9ca3af', fontFamily: "'Geist Mono',monospace" }}>
              / {weekSummary.daysLabel}d
            </span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: 600, fontFamily: "'Geist Mono',monospace", color: accent }}>
            {weekSummary.earnLabel}
          </div>
        </div>

        <div style={{ padding: '20px 22px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#9ca3af',
                fontFamily: "'Geist Mono',monospace",
              }}
            >
              Month
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                onClick={monthHeatmap.onPrevYear}
                title="Previous year"
                aria-label="Previous year"
                style={heatmapNavButtonStyle}
              >
                «
              </button>
              <button
                type="button"
                onClick={monthHeatmap.onPrevMonth}
                title="Previous month"
                aria-label="Previous month"
                style={heatmapNavButtonStyle}
              >
                ‹
              </button>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#6b7280',
                  fontFamily: "'Geist Mono',monospace",
                  minWidth: '92px',
                  textAlign: 'center',
                }}
              >
                {monthHeatmap.monthLabel}
              </div>
              <button
                type="button"
                onClick={monthHeatmap.onNextMonth}
                title="Next month"
                aria-label="Next month"
                style={heatmapNavButtonStyle}
              >
                ›
              </button>
              <button
                type="button"
                onClick={monthHeatmap.onNextYear}
                title="Next year"
                aria-label="Next year"
                style={heatmapNavButtonStyle}
              >
                »
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
            {monthHeatmap.dowLabels.map((label) => (
              <div
                key={label}
                style={{
                  textAlign: 'center',
                  fontSize: '10px',
                  letterSpacing: '0.04em',
                  color: '#9ca3af',
                  fontFamily: "'Geist Mono',monospace",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {monthHeatmap.weeks.map((week, weekIndex) => (
              <div key={weekIndex} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {week.map((cell) => (
                  <div
                    key={cell.iso}
                    className="month-heatmap-cell"
                    style={cell.style}
                    onClick={cell.onClick}
                    title={cell.hoursLabel ? `${cell.iso} · ${cell.hoursLabel}` : cell.iso}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, textAlign: 'right', lineHeight: 1, fontFamily: "'Geist Mono',monospace" }}>
                      {cell.dayNum}
                    </div>
                    {cell.hoursLabel && (
                      <div style={{ fontSize: '10px', fontWeight: 600, lineHeight: 1, fontFamily: "'Geist Mono',monospace" }}>
                        {cell.hoursLabel}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

export default TrackView
