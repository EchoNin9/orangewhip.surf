import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the subtree and shows
 * a branded fallback instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container-max section-padding text-center py-24">
          <div className="mx-auto max-w-md">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-primary-500/10 flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-display font-bold text-secondary-100 mb-3">
              Something went wrong
            </h2>
            <p className="text-secondary-400 mb-8">
              This page ran into an unexpected error. Try going back to the
              home page or refreshing.
            </p>

            <div className="flex justify-center gap-4">
              <Link to="/" className="btn-primary" onClick={this.handleReset}>
                Back to Home
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
