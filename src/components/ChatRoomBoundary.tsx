import { Component, type ErrorInfo, type ReactNode } from "react";

export default class ChatRoomBoundary extends Component<{ children: ReactNode; roomName?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Chat room render failed", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="grid min-h-[360px] place-items-center bg-[#313338] p-6 text-center">
          <div>
            <p className="text-sm font-bold text-white">{this.props.roomName ?? "Chat"} paused</p>
            <p className="mt-1 text-xs text-white/40">The selected channel stayed open. Try the panel again.</p>
            <button type="button" onClick={() => this.setState({ failed: false })} className="cursor-target mt-4 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4752c4]">Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
