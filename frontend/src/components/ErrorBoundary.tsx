import { Component, type ReactNode } from "react";
import { OctagonAlert } from "lucide-react";
import { StatusPage } from "./patterns/StatusPage";
import { Button } from "./ui/Button";

/** Catches render errors in routed page content and shows a "Something went wrong" state, sidebar/header intact. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Unhandled render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <StatusPage
          icon={OctagonAlert}
          title="Something went wrong"
          description="An unexpected error occurred. Reloading the page usually fixes it."
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
