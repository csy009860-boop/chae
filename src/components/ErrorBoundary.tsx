import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      try {
        const errorData = JSON.parse(this.state.error?.message || '{}');
        if (errorData.error) {
          errorMessage = `데이터베이스 오류: ${errorData.error}`;
          if (errorData.error.includes('Missing or insufficient permissions')) {
            errorMessage = '권한이 부족합니다. 로그인 상태를 확인하거나 관리자에게 문의하세요.';
          }
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">문제가 발생했습니다</h1>
          <p className="text-slate-500 mb-8 max-w-md">{errorMessage}</p>
          <Button 
            className="bg-sleek-primary hover:bg-blue-600 font-bold gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCcw size={16} /> 페이지 새로고침
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
