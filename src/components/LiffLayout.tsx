'use client';

import { ReactNode } from 'react';

interface LiffLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string;
}

export default function LiffLayout({ 
  children, 
  title, 
  subtitle, 
  isLoading = false, 
  error 
}: LiffLayoutProps) {
  return (
    <div style={styles.container}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🌸</span>
          <span style={styles.logoText}>Momo</span>
        </div>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </header>

      {/* メインコンテンツ */}
      <main style={styles.main}>
        {isLoading && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingSpinner}></div>
            <p style={styles.loadingText}>読み込み中...</p>
          </div>
        )}

        {error && (
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}>⚠️</div>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {!isLoading && !error && children}
      </main>

      {/* フッター */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>お疲れさまです 🌸</p>
      </footer>
    </div>
  );
}

// デザインシステム
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#FAFAFA',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  header: {
    backgroundColor: '#FFFFFF',
    padding: '16px 20px',
    borderBottom: '1px solid #E5E5E5',
    textAlign: 'center' as const,
  },
  
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  
  logoIcon: {
    fontSize: '24px',
  },
  
  logoText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#333333',
    margin: '0 0 4px 0',
  },
  
  subtitle: {
    fontSize: '14px',
    color: '#666666',
    margin: '0',
  },
  
  main: {
    flex: 1,
    padding: '20px',
    maxWidth: '480px',
    margin: '0 auto',
    width: '100%',
  },
  
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTop: '3px solid #FF6B9D',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  
  loadingText: {
    marginTop: '12px',
    fontSize: '14px',
    color: '#666666',
  },
  
  errorContainer: {
    backgroundColor: '#FFF5F5',
    border: '1px solid #FECACA',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center' as const,
  },
  
  errorIcon: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  
  errorText: {
    fontSize: '14px',
    color: '#DC2626',
    margin: '0',
  },
  
  footer: {
    backgroundColor: '#FFFFFF',
    padding: '16px 20px',
    borderTop: '1px solid #E5E5E5',
    textAlign: 'center' as const,
  },
  
  footerText: {
    fontSize: '12px',
    color: '#999999',
    margin: '0',
  },
};
