import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div
          role="alert"
          dir="rtl"
          style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'Cairo, system-ui, sans-serif' }}
        >
          <div style={{ width: '100%', maxWidth: '560px', borderRadius: '24px', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 24px 80px rgba(15,23,42,0.12)', padding: '28px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900 }}>حدث خطأ غير متوقع</h1>
            <p style={{ margin: '12px 0 0', lineHeight: 1.8, color: '#475569', fontWeight: 700 }}>
              الصفحة واجهت مشكلة مؤقتة. جرّب إعادة التحميل، وإذا تكرر الخطأ أرسل بلاغاً للدعم.
            </p>
            {isDev && (
              <pre style={{ marginTop: '18px', maxHeight: '220px', backgroundColor: '#0f172a', color: '#e2e8f0', borderRadius: '14px', padding: '14px', overflow: 'auto', direction: 'ltr', textAlign: 'left', fontSize: '12px' }}>
                {this.state.error?.toString()}
                {'\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            )}
          <button 
            onClick={() => window.location.reload()} 
              style={{ marginTop: '20px', width: '100%', padding: '12px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '14px', fontWeight: 900 }}
          >
              إعادة تحميل الصفحة
          </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
