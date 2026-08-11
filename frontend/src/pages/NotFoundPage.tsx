import { SearchX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusPage } from "../components/patterns/StatusPage";
import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <StatusPage
      icon={SearchX}
      title="Page not found"
      description="The page you're looking for doesn't exist or may have moved."
      action={
        <Button variant="primary" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      }
    />
  );
}
