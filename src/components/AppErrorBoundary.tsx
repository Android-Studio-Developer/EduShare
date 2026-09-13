import { Component, type ErrorInfo, type ReactNode } from "react";

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="grid min-h-screen place-items-center bg-[#0d0f11] p-6 text-center text-white">
          <div>
            <p className="text-lg font-bold">Something went wrong</p>
            <p className="mt-2 text-sm text-white/50">A page on eduShare hit a bad record and crashed. Reloading fixes it.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-[#5865f2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752c4]"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
