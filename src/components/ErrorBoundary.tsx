import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Without this, any uncaught render-time error anywhere in the tree makes
// React unmount the whole app with zero feedback: a blank white screen, no
// console-visible explanation for the person using it, nothing actionable
// for us to debug from a bug report. This catches it, shows a real message,
// and logs full details to the console so the next occurrence is diagnosable
// instead of just "l'écran est blanc".
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[LoveRose] Uncaught render error:", error, errorInfo.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans text-center">
          <div className="max-w-sm w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-4">
            <div className="mx-auto bg-red-50 w-16 h-16 rounded-full flex items-center justify-center text-red-500">
              <AlertTriangle size={28} />
            </div>
            <h1 className="font-extrabold text-lg text-slate-800">Une erreur est survenue</h1>
            <p className="text-sm text-slate-500">
              LoveRose a rencontré un problème inattendu. L'équipe technique a été informée via les journaux.
            </p>
            {this.state.error && (
              <p className="text-[10px] font-mono text-slate-400 bg-slate-50 rounded-xl p-2 break-words">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
