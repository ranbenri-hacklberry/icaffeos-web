import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-red-50 rounded-xl border border-red-200 text-center" dir="rtl">
                    <AlertTriangle className="text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-red-800 mb-2">משהו השתבש</h2>
                    <p className="text-sm text-red-600 mb-4">
                        {this.props.fallbackMessage || 'אירעה שגיאה בטעינת הרכיב. נסה שוב או פנה לתמיכה.'}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-bold"
                    >
                        <RefreshCw size={16} />
                        נסה שוב
                    </button>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <details className="mt-4 text-left text-xs text-red-700 bg-red-100 p-2 rounded max-w-full overflow-auto">
                            <summary className="cursor-pointer font-bold">פרטים טכניים</summary>
                            <pre className="mt-2 whitespace-pre-wrap">{this.state.error.toString()}</pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
