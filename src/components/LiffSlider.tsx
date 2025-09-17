'use client';

interface LiffSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  leftLabel?: string;
  rightLabel?: string;
}

export default function LiffSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  leftLabel,
  rightLabel
}: LiffSliderProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>{label}</span>
        <span style={styles.value}>{value}</span>
      </div>
      
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.slider}
      />
      
      {(leftLabel || rightLabel) && (
        <div style={styles.labels}>
          <span style={styles.leftLabel}>{leftLabel}</span>
          <span style={styles.rightLabel}>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    marginBottom: '16px',
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  
  value: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#FF6B9D',
    backgroundColor: '#FFF0F4',
    padding: '4px 8px',
    borderRadius: '8px',
    minWidth: '32px',
    textAlign: 'center' as const,
  },
  
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    background: 'linear-gradient(to right, #FF6B9D 0%, #FF6B9D 100%)',
    outline: 'none',
    appearance: 'none' as const,
    marginBottom: '8px',
  },
  
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#6B7280',
  },
  
  leftLabel: {
    fontSize: '12px',
    color: '#6B7280',
  },
  
  rightLabel: {
    fontSize: '12px',
    color: '#6B7280',
  },
};
