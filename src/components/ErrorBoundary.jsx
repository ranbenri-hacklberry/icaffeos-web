import React from 'react';
import { motion } from 'framer-motion';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback, showDetails = false } = this.props;

      if (Fallback) {
        return <Fallback error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`relative max-w-lg w-full p-10 rounded-[3rem] text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden border-4 ${document.documentElement.classList.contains('dark')
              ? 'bg-slate-800/90 border-slate-700/50'
              : 'bg-white/90 border-slate-100'
              } backdrop-blur-xl`}
          >
            {/* Animated Background Decoration */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"
            />
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                rotate: [0, -90, 0],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none"
            />

            <div className="relative z-10">
              <motion.span
                initial={{ rotate: -20, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                className="text-8xl mb-8 block drop-shadow-2xl"
              >
                🥯🔥
              </motion.span>

              <h3 className={`text-4xl font-black mb-4 tracking-tight ${document.documentElement.classList.contains('dark') ? 'text-white' : 'text-slate-900'
                }`}>
                אופס! המנה נשרפה במטבח...
              </h3>

              <p className={`text-xl font-medium mb-10 leading-relaxed opacity-80 ${document.documentElement.classList.contains('dark') ? 'text-slate-300' : 'text-slate-600'
                }`}>
                משהו השתבש בבישול של הרכיב הזה. <br />
                אל דאגה, השף כבר רץ לכיוון המטף! 👨‍🍳🔥
              </p>

              <div className="flex flex-col gap-4">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleRetry}
                  className="w-full py-5 rounded-3xl bg-gradient-to-r from-orange-500 via-pink-500 to-rose-500 text-white font-black text-xl shadow-[0_12px_24px_-6px_rgba(249,115,22,0.4)] transition-all"
                >
                  נסה להחזיר את האש
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.location.href = '/mode-selection'}
                  className={`w-full py-4 rounded-3xl font-bold text-base transition-all ${document.documentElement.classList.contains('dark')
                    ? 'text-slate-400 hover:text-white bg-slate-700/50'
                    : 'text-slate-500 hover:text-slate-800 bg-slate-100'
                    }`}
                >
                  ברח חזרה הביתה 🏠
                </motion.button>
              </div>

              {showDetails && this.state.error && (
                <motion.details
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="mt-10 text-right bg-black/10 p-5 rounded-[2rem] text-[10px] opacity-40 hover:opacity-100 transition-opacity"
                >
                  <summary className="cursor-pointer font-bold uppercase tracking-widest text-slate-400 list-none">
                    פרטים טכניים לשפים מנוסים 🛠️
                  </summary>
                  <pre className="mt-4 whitespace-pre-wrap font-mono leading-tight overflow-x-auto text-left dir-ltr">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </motion.details>
              )}
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;