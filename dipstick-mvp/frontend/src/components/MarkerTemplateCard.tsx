import React from 'react';

interface MarkerTemplateCardProps {
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

export default function MarkerTemplateCard({
  compact = false,
  title = 'Marker-Assisted Template',
  subtitle = 'Place the strip inside the lane and keep the fiducial marker visible.',
}: MarkerTemplateCardProps) {
  return (
    <div style={{ ...styles.card, ...(compact ? styles.cardCompact : {}) }}>
      <div style={styles.copy}>
        <div style={styles.eyebrow}>Standardized Capture</div>
        <div style={styles.title}>{title}</div>
        <div style={styles.subtitle}>{subtitle}</div>
      </div>

      <div style={{ ...styles.template, ...(compact ? styles.templateCompact : {}) }}>
        <div style={styles.markerWrap}>
          <div style={styles.markerGrid}>
            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={styles.cell} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />

            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={styles.cell} />
            <div style={{ ...styles.cell, ...styles.cellAccent }} />
            <div style={styles.cell} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />

            <div style={styles.cell} />
            <div style={{ ...styles.cell, ...styles.cellAccent }} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={{ ...styles.cell, ...styles.cellAccent }} />
            <div style={styles.cell} />

            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={styles.cell} />
            <div style={{ ...styles.cell, ...styles.cellAccent }} />
            <div style={styles.cell} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />

            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={styles.cell} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />
            <div style={{ ...styles.cell, ...styles.cellDark }} />
          </div>
          <div style={styles.markerLabel}>Marker</div>
        </div>

        <div style={styles.lane}>
          <div style={styles.laneTopLabel}>Dipstick lane</div>
          <div style={styles.stripGhost}>
            <div style={styles.pad} />
            <div style={styles.pad} />
            <div style={styles.pad} />
            <div style={styles.pad} />
            <div style={styles.pad} />
          </div>
        </div>

        <div style={styles.barcodeCluster}>
          <div style={{ ...styles.bar, height: 18 }} />
          <div style={{ ...styles.bar, height: 28 }} />
          <div style={{ ...styles.bar, height: 14 }} />
          <div style={{ ...styles.bar, height: 32 }} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #F8FAFC 0%, #ECFEFF 100%)',
    border: '1px solid #CFFAFE',
  },
  cardCompact: {
    padding: '12px',
    gap: '10px',
  },
  copy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#0F766E',
  },
  title: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0F172A',
  },
  subtitle: {
    fontSize: '13px',
    lineHeight: 1.45,
    color: '#475569',
  },
  template: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '70px 1fr 32px',
    alignItems: 'center',
    gap: '14px',
    minHeight: '128px',
    padding: '14px',
    borderRadius: '18px',
    backgroundColor: '#FFFFFF',
    boxShadow: 'inset 0 0 0 1px #E2E8F0',
  },
  templateCompact: {
    minHeight: '108px',
    padding: '10px',
    gap: '10px',
    gridTemplateColumns: '60px 1fr 24px',
  },
  markerWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  markerGrid: {
    width: '44px',
    height: '44px',
    padding: '4px',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    boxShadow: 'inset 0 0 0 2px #F59E0B',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gridTemplateRows: 'repeat(5, 1fr)',
    gap: '1px',
  },
  cell: {
    backgroundColor: '#FFFFFF',
  },
  cellDark: {
    backgroundColor: '#0F172A',
  },
  cellAccent: {
    backgroundColor: '#14B8A6',
  },
  markerLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#0F766E',
  },
  lane: {
    position: 'relative',
    height: '100%',
    minHeight: '78px',
    borderRadius: '12px',
    border: '2px dashed #14B8A6',
    backgroundColor: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 12px',
  },
  laneTopLabel: {
    position: 'absolute',
    top: '8px',
    left: '10px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#0F766E',
  },
  stripGhost: {
    width: '100%',
    height: '22px',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #FFFFFF 0%, #F8FAFC 100%)',
    boxShadow: 'inset 0 0 0 1px #CBD5E1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: '0 12px',
  },
  pad: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    background: 'linear-gradient(135deg, #CFFAFE 0%, #FDE68A 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.08)',
  },
  barcodeCluster: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '3px',
    justifyContent: 'flex-end',
    paddingBottom: '6px',
  },
  bar: {
    width: '3px',
    backgroundColor: '#0F172A',
    borderRadius: '999px',
  },
};
