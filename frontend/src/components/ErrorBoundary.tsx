import React, { Component, type ReactNode } from 'react'
import { Alert, Button } from 'antd'

interface Props {
  children: ReactNode
  fallbackMessage?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-white rounded-xl border border-red-200 shadow-xs my-2">
          <Alert
            type="error"
            showIcon
            message={this.props.fallbackMessage || 'Something went wrong rendering this section.'}
            description={this.state.error?.message || 'A client-side rendering error occurred.'}
            action={
              <Button
                size="small"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  this.props.onReset?.()
                }}
              >
                Try Again
              </Button>
            }
          />
        </div>
      )
    }

    return this.props.children
  }
}
