import { useEffect, useRef, useState, type CSSProperties, type FC } from 'react'
import type { MatrixCellVM, TrackViewProps } from '../types'

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

const headerCellStyle = (isToday: boolean, isWeekend: boolean, accent: string): CSSProperties => ({
  padding: '9px 8px',
  fontSize: '11px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: "'Geist Mono',monospace",
  fontWeight: isToday ? 600 : 500,
  color: isToday ? accent : '#9ca3af',
  textAlign: 'center',
  background: isWeekend ? '#fbfcfd' : undefined,
  borderBottom: '1px solid #e9ebef',
  whiteSpace: 'nowrap',
})

// One hours cell. Single-entry / empty cells edit inline: click → input,
// Enter/blur commits (0 deletes the entry), Escape cancels. Non-editable
// cells (multi-entry, or new customer flat fees needing an amount) open the
// entry modal instead. The hover "⋯" opens the modal for comment/attachments.
const MatrixCell: FC<{ cell: MatrixCellVM; accent: string }> = ({ cell, accent }) => {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.select()
    }
  }, [editing])

  const startEdit = (): void => {
    if (!cell.editable) {
      cell.onOpen?.()
      return
    }
    setValue(cell.editValue)
    setEditing(true)
  }

  const commit = (): void => {
    setEditing(false)
    if (value !== cell.editValue) {
      cell.onCommit(value)
    }
  }

  const filled = cell.hoursLabel !== ''

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="matrix-cell-input"
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit()
          }
          if (event.key === 'Escape') {
            setEditing(false)
          }
        }}
        style={{
          width: '52px',
          padding: '6px 4px',
          borderRadius: '7px',
          border: `1.5px solid ${accent}`,
          outline: 'none',
          textAlign: 'center',
          fontFamily: "'Geist Mono',monospace",
          fontSize: '13px',
          fontWeight: 600,
          background: '#fff',
        }}
      />
    )
  }

  return (
    <span className="matrix-cell-wrap">
      <button
        type="button"
        className={`matrix-cell ${filled ? 'matrix-cell--filled' : 'matrix-cell--empty'}`}
        onClick={startEdit}
        title={cell.title || undefined}
        style={{
          position: 'relative',
          minWidth: '52px',
          padding: '6px 4px',
          borderRadius: '7px',
          border: '1px solid transparent',
          cursor: 'pointer',
          textAlign: 'center',
          fontFamily: "'Geist Mono',monospace",
          fontSize: '13px',
          fontWeight: 600,
          background: filled ? '#f2f6ff' : 'transparent',
          color: filled ? '#1a1c20' : '#d0d4da',
        }}
      >
        {filled ? cell.hoursLabel : '·'}
        {cell.hasDetails && (
          <span
            style={{
              position: 'absolute',
              top: '3px',
              right: '3px',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: accent,
              opacity: 0.7,
            }}
          />
        )}
      </button>
      {cell.entryCount > 0 && cell.editable && cell.onOpen && (
        <button
          type="button"
          className="matrix-cell-open"
          title="Open entry (comment, attachments)"
          aria-label="Open entry details"
          onClick={cell.onOpen}
        >
          ⋯
        </button>
      )}
    </span>
  )
}

const TrackView: FC<TrackViewProps> = ({ matrix, weekSummary, monthHeatmap, accent }) => {
  return (
    <div className="track-view-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', background: '#ffffff', borderRight: '1px solid #e9ebef' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '22px 22px 40px' }}>
          <div className="track-matrix-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...headerCellStyle(false, false, accent),
                      textAlign: 'left',
                      width: '220px',
                      paddingLeft: '2px',
                    }}
                  >
                    Project
                  </th>
                  {matrix.dayHeaders.map((header) => (
                    <th key={header.iso} style={headerCellStyle(header.isToday, header.isWeekend, accent)}>
                      {header.label}
                    </th>
                  ))}
                  <th style={{ ...headerCellStyle(false, false, accent), textAlign: 'right', paddingRight: '4px' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.key}>
                    <td style={{ padding: '10px 8px 10px 2px', borderBottom: '1px solid #eef0f3' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: '160px' }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '3px',
                            background: row.dotColor,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {row.name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '1px' }}>{row.subLabel}</div>
                        </div>
                      </div>
                    </td>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.iso}
                        style={{
                          textAlign: 'center',
                          padding: '5px 3px',
                          borderBottom: '1px solid #eef0f3',
                          background: cell.isWeekend ? '#fbfcfd' : undefined,
                        }}
                      >
                        <MatrixCell cell={cell} accent={accent} />
                      </td>
                    ))}
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 4px 10px 8px',
                        borderBottom: '1px solid #eef0f3',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>
                        {row.totalHoursLabel}
                      </div>
                      {row.totalEarnLabel && (
                        <div style={{ fontSize: '12px', color: accent, fontFamily: "'Geist Mono',monospace", marginTop: '2px' }}>
                          {row.totalEarnLabel}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {matrix.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={matrix.dayHeaders.length + 2}
                      style={{ padding: '28px 8px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}
                    >
                      Nothing logged this week yet.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '11px 8px 4px 2px', fontSize: '13px', fontWeight: 600 }}>Day total</td>
                  {matrix.dayTotals.map((total, index) => (
                    <td
                      key={matrix.dayHeaders[index].iso}
                      style={{
                        textAlign: 'center',
                        padding: '11px 3px 4px',
                        fontSize: '12.5px',
                        color: '#6b7280',
                        fontFamily: "'Geist Mono',monospace",
                        background: matrix.dayHeaders[index].isWeekend ? '#fbfcfd' : undefined,
                      }}
                    >
                      {total || '·'}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', padding: '11px 4px 4px 8px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>
                      {matrix.totalHoursLabel}
                    </div>
                    <div style={{ fontSize: '12px', color: accent, fontFamily: "'Geist Mono',monospace", marginTop: '2px' }}>
                      {matrix.totalEarnLabel}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            type="button"
            className="track-add-entry"
            onClick={matrix.onAddEntry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 12px',
              marginTop: '14px',
              width: '100%',
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
