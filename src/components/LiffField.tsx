'use client';

import { ReactNode } from 'react';

interface LiffFieldProps {
  label: string;
  children: ReactNode;
  description?: string;
  required?: boolean;
}

export default function LiffField({ 
  label, 
  children, 
  description, 
  required = false 
}: LiffFieldProps) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label}
        {required && <span style={styles.required}>*</span>}
      </label>
      {description && <p style={styles.description}>{description}</p>}
      <div style={styles.input}>
        {children}
      </div>
    </div>
  );
}

const styles = {
  field: {
    marginBottom: '16px',
  },
  
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px',
  },
  
  required: {
    color: '#EF4444',
    marginLeft: '2px',
  },
  
  description: {
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  
  input: {
    // 子要素のスタイルは個別に定義
  },
};
