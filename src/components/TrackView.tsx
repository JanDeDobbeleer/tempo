import { Fragment, useEffect, type CSSProperties, type FC } from 'react'
import type { TrackCalendarVM, TrackMonthDayVM, TrackViewProps } from '../types'
import { addDays, iso, parseISO } from '../lib/dates'

const navButtonStyle: CSSProperties = {
  width: '22px',
  height: '22px',
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

const statLabelStyle: CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#9ca3af',
  fontFamily: "'Geist Mono',monospace",
}

const sectionLabelStyle: CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#9ca3af',
  fontFamily: "'Geist Mono',monospace",
  marginBottom: '10px',
}

const Stat: FC<{ label: string; value: string; accent?: string; first?: boolean }> = ({ label, value, accent, first }) => (
  <div
    style={{
      padding: first ? '0 22px 0 0' : '0 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      borderLeft: first ? 'none' : '1px solid #eef0f3',
    }}
  >
    <div style={statLabelStyle}>{label}</div>
    <div style={{ fontSize: '19px', fontWeight: 600, letterSpacing: '-0.01em', fontFamily: "'Geist Mono',monospace", color: accent }}>
      {value}
    </div>
  </div>
)

// One day cell in the month grid. Shading + pips encode hours logged and
// which contexts were touched that day. Clicking selects the day into the
// side panel; clicking the already-selected day returns to the glance state.
const CalCell: FC<{ day: TrackMonthDayVM; accent: string }> = ({ day, accent }) => {
  const isOther = !day.isCurrentMonth
  return (
    <button
      type="button"
      className="cal-cell"
      onClick={day.onClick}
      disabled={isOther}
      title={day.title}
      style={{
        aspectRatio: '1.05',
        border: day.isSelected ? `1.5px solid ${accent}` : '1px solid #eef0f3',
        boxShadow: day.isSelected ? `0 0 0 3px ${accent}22` : 'none',
        borderRadius: '10px',
        padding: '8px',
        cursor: isOther ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: !day.hasData && day.isWeekend ? '#f5f6f8' : '#fff',
        opacity: isOther ? 0.34 : 1,
        animationName: isOther ? 'none' : undefined,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: "'Geist Mono',monospace",
          textAlign: 'right',
          color: day.isToday ? accent : (day.hasData ? '#1a1c20' : '#c4c8cf'),
        }}
      >
        {day.dayNum}
      </div>
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
        {day.pips.map((color, index) => (
          <span key={index} style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '4px' }}>
        <span style={{ fontSize: '10.5px', fontFamily: "'Geist Mono',monospace", color: '#6b7280' }}>{day.hoursLabel}</span>
        {day.earnLabel && (
          <span style={{ fontSize: '9.5px', fontFamily: "'Geist Mono',monospace", color: accent, opacity: 0.85 }}>
            {day.earnLabel}
          </span>
        )}
      </div>
    </button>
  )
}

const CalendarPanel: FC<{ calendar: TrackCalendarVM; accent: string }> = ({ calendar, accent }) => {
  const { panel } = calendar

  if (panel.mode === 'day') {
    return (
      <>
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #eef0f3' }}>
          <button
            type="button"
            onClick={panel.onBack}
            style={{ border: 'none', background: 'transparent', color: '#9ca3af', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', padding: '0 0 8px', display: 'block', fontFamily: 'inherit' }}
          >
            ‹ Month overview
          </button>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{panel.dateLabel}</div>
          {panel.hoursLabel && (
            <div style={{ fontSize: '12px', color: '#9ca3af', fontFamily: "'Geist Mono',monospace", marginTop: '3px' }}>
              {panel.hoursLabel}{panel.earnLabel ? ` · ${panel.earnLabel}` : ''}
            </div>
          )}
        </div>
        <div className="cal-panel-body" style={{ flex: 1 }}>
          <div style={{ padding: '12px 16px' }}>
            {panel.entries.length === 0 && (
              <div style={{ padding: '30px 22px 10px', textAlign: 'center', color: '#9ca3af', fontSize: '12.5px' }}>
                Nothing logged this day yet.
              </div>
            )}
            {panel.entries.map((entry) => (
              <div
                key={entry.id}
                className="cal-prow"
                onClick={entry.onClick}
                style={{ display: 'flex', gap: '10px', padding: '11px 12px', borderRadius: '10px', cursor: 'pointer', border: '1px solid #eef0f3', background: '#fff', marginBottom: '6px' }}
              >
                <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: entry.dotColor, flexShrink: 0, marginTop: '3px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{entry.name}</div>
                  <div style={{ fontSize: '12px', color: '#8a909a', marginTop: '2px' }}>{entry.subLabel}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {entry.hoursLabel && (
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>{entry.hoursLabel}</div>
                  )}
                  {entry.earnLabel && (
                    <div style={{ fontSize: '12px', color: accent, fontFamily: "'Geist Mono',monospace", marginTop: '1px' }}>{entry.earnLabel}</div>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="cal-add-entry"
              onClick={panel.onAddEntry}
              style={{ width: '100%', display: 'block', padding: '9px 12px', borderRadius: '10px', cursor: 'pointer', border: '1px dashed #d7dadf', background: 'transparent', color: '#9ca3af', fontSize: '13px', textAlign: 'left', fontFamily: 'inherit' }}
            >
              + Add entry
            </button>
          </div>
        </div>
      </>
    )
  }

  const topMinutesPct = Math.max(1, ...panel.topProjects.map((project) => project.barPct))

  return (
    <div className="cal-panel-body" style={{ flex: 1, padding: '20px 22px 24px' }}>
      {panel.topProjects.length === 0 ? (
        <div style={{ padding: '20px 0 10px', textAlign: 'center', color: '#9ca3af', fontSize: '12.5px' }}>
          Nothing logged this month yet.
        </div>
      ) : (
        <>
          <div style={sectionLabelStyle}>Top projects</div>
          {panel.topProjects.map((project) => (
            <div key={project.key} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{project.name}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '5px' }}>{project.subLabel}</span>
                </div>
                <span style={{ fontSize: '12px', fontFamily: "'Geist Mono',monospace", color: '#6b7280', flexShrink: 0 }}>
                  {project.hoursLabel}
                </span>
              </div>
              <div style={{ height: '6px', borderRadius: '4px', background: '#eef0f3', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '4px', width: `${Math.max(4, (project.barPct / topMinutesPct) * 100)}%`, background: project.dotColor }} />
              </div>
            </div>
          ))}
        </>
      )}

      <button
        type="button"
        className="cal-add-entry"
        onClick={panel.onAddEntry}
        style={{ width: '100%', display: 'block', padding: '9px 12px', marginTop: '18px', borderRadius: '10px', cursor: 'pointer', border: '1px dashed #d7dadf', background: 'transparent', color: '#9ca3af', fontSize: '13px', textAlign: 'left', fontFamily: 'inherit' }}
      >
        + Add entry
      </button>
    </div>
  )
}

const TrackView: FC<TrackViewProps> = ({ calendar, accent }) => {
  // Arrow keys move the selected day when the calendar has focus. Only
  // active once a day is selected — the month-at-a-glance state doesn't
  // have a "current" day to move from.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (calendar.panel.mode !== 'day') {
        return
      }
      const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
      const delta = deltas[event.key]
      if (delta === undefined) {
        return
      }
      const active = document.activeElement
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
        return
      }
      event.preventDefault()
      const nextISO = iso(addDays(parseISO(calendar.panel.iso), delta))
      const cell = calendar.weeks.flatMap((week) => week.days).find((day) => day.iso === nextISO)
      cell?.onClick()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [calendar])

  return (
    <div className="track-view-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1.35, overflow: 'auto', background: '#ffffff', borderRight: '1px solid #e9ebef' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '18px 22px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
            <button type="button" style={navButtonStyle} onClick={calendar.onPrevYear} title="Previous year" aria-label="Previous year">«</button>
            <button type="button" style={navButtonStyle} onClick={calendar.onNextYear} title="Next year" aria-label="Next year">»</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch', paddingBottom: '16px', marginBottom: '14px', borderBottom: '1px solid #eef0f3' }}>
            <Stat label="Hours" value={calendar.summary.hoursLabel} first />
            <Stat label="Billable days" value={calendar.summary.daysLabel} />
            <Stat label="Earnings" value={calendar.summary.earnLabel} accent={accent} />
            <Stat label="Entries" value={calendar.summary.entryCountLabel} />
          </div>

          <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, 1fr)', gap: '6px' }}>
            <div />
            {calendar.dowLabels.map((label) => (
              <div
                key={label}
                style={{ textAlign: 'center', fontSize: '11px', letterSpacing: '0.05em', color: '#9ca3af', fontFamily: "'Geist Mono',monospace", paddingBottom: '4px' }}
              >
                {label}
              </div>
            ))}

            {calendar.weeks.map((week, weekIndex) => (
              <Fragment key={`gutter-${weekIndex}`}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', color: '#9ca3af', fontFamily: "'Geist Mono',monospace" }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.03em' }}>{week.weekLabel}</span>
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>{week.hoursLabel}</span>
                </div>
                {week.days.map((day) => (
                  <CalCell key={day.iso} day={day} accent={accent} />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <aside
        className="track-view-aside"
        style={{ width: '340px', flexShrink: 0, background: '#fbfcfd', display: 'flex', flexDirection: 'column', overflow: 'auto' }}
        tabIndex={-1}
      >
        <CalendarPanel calendar={calendar} accent={accent} />
      </aside>
    </div>
  )
}

export default TrackView
