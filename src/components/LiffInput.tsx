'use client';

interface LiffInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'email' | 'password';
}

export default function LiffInput({
  value,
  onChange,
  placeholder,
  maxLength,
  multiline = false,
  rows = 3,
  type = 'text'
}: LiffInputProps) {
  const inputStyles = {
    ...styles.input,
    ...(multiline && { ...styles.textarea, height: `${rows * 24 + 16}px` }),
  };

  if (multiline) {
    return (
      <div style={styles.container}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          style={inputStyles}
        />
        {maxLength && (
          <div style={styles.counter}>
            {value.length}/{maxLength}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={inputStyles}
      />
      {maxLength && (
        <div style={styles.counter}>
          {value.length}/{maxLength}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative' as const,
  },
  
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #E5E7EB',
    borderRadius: '12px',
    fontSize: '16px',
    color: '#374151',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  
  textarea: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #E5E7EB',
    borderRadius: '12px',
    fontSize: '16px',
    color: '#374151',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  
  counter: {
    position: 'absolute' as const,
    bottom: '8px',
    right: '12px',
    fontSize: '12px',
    color: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    padding: '2px 6px',
    borderRadius: '4px',
  },
};
