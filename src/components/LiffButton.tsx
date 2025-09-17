'use client';

interface LiffButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
}

export default function LiffButton({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  fullWidth = false,
  type = 'button',
  style
}: LiffButtonProps) {
  const buttonStyles = {
    ...styles.button,
    ...styles.variant[variant],
    ...styles.size[size],
    ...(fullWidth && styles.fullWidth),
    ...(disabled && styles.disabled),
    ...style,
  };

  return (
    <button
      type={type}
      style={buttonStyles}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

const styles = {
  button: {
    border: 'none',
    borderRadius: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  
  variant: {
    primary: {
      backgroundColor: '#FF6B9D',
      color: '#FFFFFF',
      boxShadow: '0 2px 8px rgba(255, 107, 157, 0.3)',
    },
    secondary: {
      backgroundColor: '#F3F4F6',
      color: '#374151',
      border: '1px solid #D1D5DB',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#FF6B9D',
      border: '2px solid #FF6B9D',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#6B7280',
      border: 'none',
    },
  },
  
  size: {
    small: {
      padding: '8px 12px',
      fontSize: '14px',
    },
    medium: {
      padding: '12px 16px',
      fontSize: '16px',
    },
    large: {
      padding: '16px 20px',
      fontSize: '16px',
    },
  },
  
  fullWidth: {
    width: '100%',
  },
  
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
    boxShadow: 'none',
  },
};
