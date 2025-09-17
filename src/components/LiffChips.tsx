'use client';

interface LiffChipsProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  variant?: 'default' | 'compact';
}

export default function LiffChips({
  options,
  value,
  onChange,
  variant = 'default'
}: LiffChipsProps) {
  const chipStyles = variant === 'compact' ? styles.compactChip : styles.chip;

  return (
    <div style={styles.container}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          style={{
            ...chipStyles,
            ...(value === option ? styles.selected : styles.unselected),
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  
  chip: {
    padding: '10px 16px',
    borderRadius: '20px',
    border: '2px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#374151',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '60px',
    textAlign: 'center' as const,
  },
  
  compactChip: {
    padding: '6px 12px',
    borderRadius: '16px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#374151',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '50px',
    textAlign: 'center' as const,
  },
  
  selected: {
    backgroundColor: '#FFF0F4',
    borderColor: '#FF6B9D',
    color: '#FF6B9D',
    fontWeight: '600',
  },
  
  unselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    color: '#374151',
  },
};
