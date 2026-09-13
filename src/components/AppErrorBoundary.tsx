import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  clearChunkRecoveryGuard,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "../lib/chunkRecovery";

type AppErrorState = {
  failed: boolean;
  staleChunk: boolean;
};

export default class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorState> {
  state: AppErrorState = { failed: false, staleChunk: false };

  private recoveryResetTimer?: number;

  static getDerivedStateFromError(error: Error): AppErrorState {
    return { failed: true, staleChunk: isChunkLoadError(error) };
  }

  componentDidMount() {
    this.recoveryResetTimer = window.setTimeout(clearChunkRecoveryGuard, 10_000);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (recoverFromChunkLoadError(error)) return;
    console.error("App crashed", error, info.componentStack);
  }

  componentWillUnmount() {
    if (this.recoveryResetTimer) window.clearTimeout(this.recoveryResetTimer);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="grid min-h-screen place-items-center bg-[#0d0f11] p-6 text-center text-white">
          <div>
            <p className="text-lg font-bold">
              {this.state.staleChunk ? "eduShare was updated" : "Something went wrong"}
            </p>
            <p className="mt-2 text-sm text-white/50">
              {this.state.staleChunk
                ? "This tab still has an older version. Reload once to finish updating."
                : "A page on eduShare hit a bad record and crashed. Reloading fixes it."}
            </p>
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
