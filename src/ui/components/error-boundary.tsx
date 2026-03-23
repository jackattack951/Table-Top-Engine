import React from 'react'

interface ErrorBoundaryProps {
    children: React.ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
}

/**
 * Catches render errors in cockpit tab content.
 * Shows a graceful fallback instead of crashing the entire app.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('[ErrorBoundary] Caught render error:', error, info.componentStack)
    }

    handleReset = (): void => {
        this.setState({ hasError: false })
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary__content">
                        <h2 className="error-boundary__title">Something went wrong</h2>
                        <p className="error-boundary__message">
                            This tab encountered an unexpected error. Your data is safe.
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={this.handleReset}
                        >
                            Reload Tab
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
