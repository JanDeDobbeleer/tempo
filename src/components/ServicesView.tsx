import type { FC } from 'react';

import type { ServicesViewProps } from '../types';

const ServicesView: FC<ServicesViewProps> = ({ serviceRows, serviceEmpty }) => (
  <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div
        className="svc-grid-header"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,2.4fr) 1fr 0.9fr 1.1fr',
          gap: '16px',
          padding: '0 18px 12px',
          fontSize: '11px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: '#9ca3af',
          fontFamily: "'Geist Mono',monospace",
        }}
      >
        <div>Service</div>
        <div style={{ textAlign: 'right' }}>Flat rate</div>
        <div style={{ textAlign: 'right' }}>Logged</div>
        <div style={{ textAlign: 'right' }}>Earnings</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {serviceRows.map((row) => (
          <div
            key={row.id}
            className="service-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,2.4fr) 1fr 0.9fr 1.1fr',
              gap: '16px',
              alignItems: 'center',
              padding: '16px 18px',
              background: '#fff',
              border: '1px solid #e9ebef',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
            onClick={row.onClick}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={row.dotStyle} />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.name}
              </span>
            </div>

            <div style={{ textAlign: 'right', fontSize: '13px', fontFamily: "'Geist Mono',monospace" }}>
              {row.currentRate}
            </div>

            <div style={{ textAlign: 'right', fontSize: '13px', color: '#626873', fontFamily: "'Geist Mono',monospace" }}>
              {row.hours}
            </div>

            <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>
              {row.earn}
            </div>
          </div>
        ))}
      </div>

      {serviceEmpty && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '14px' }}>
          No services yet. Create your first one.
        </div>
      )}
    </div>
  </div>
);

export default ServicesView;
