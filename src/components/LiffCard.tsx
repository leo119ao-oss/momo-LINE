'use client';

import { ReactNode } from 'react';

interface LiffCardProps {
  children: ReactNode;
  padding?: 'small' | 'medium' | 'large';
  margin?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'accent' | 'warning';
}

export default function LiffCard({ 
  children, 
  padding = 'medium',
  margin = 'small',
  variant = 'default'
}: LiffCardProps) {
  const cardStyles = {
    ...styles.card,
    ...styles.padding[padding],
    ...styles.margin[margin],
    ...styles.variant[variant],
  };

  return (
    <div style={cardStyles}>
      {children}
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E5E5',
  },
  
  padding: {
    small: { padding: '12px' },
    medium: { padding: '16px' },
    large: { padding: '20px' },
  },
  
  margin: {
    small: { marginBottom: '12px' },
    medium: { marginBottom: '16px' },
    large: { marginBottom: '20px' },
  },
  
  variant: {
    default: {},
    accent: {
      backgroundColor: '#FFF0F4',
      borderColor: '#FFB3C6',
    },
    warning: {
      backgroundColor: '#FFF5F5',
      borderColor: '#FECACA',
    },
  },
};
