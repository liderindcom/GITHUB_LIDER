import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  boundary: string;
  fallback?: ReactNode;
};

type State = { failed: boolean };

/** Keeps an optional portal panel from taking down the complete route. */
export class RenderErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportLovableError(error, {
      boundary: `render_error_boundary:${this.props.boundary}`,
      componentStack: info.componentStack?.slice(0, 1200),
    });
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
