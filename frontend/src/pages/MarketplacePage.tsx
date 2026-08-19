import { ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusPage } from "../components/patterns/StatusPage";
import { Button } from "../components/ui/Button";

export function MarketplacePage() {
  const navigate = useNavigate();

  return (
    <StatusPage
      icon={ShoppingCart}
      title="Coming soon"
      description="New integrations and add-ons are coming soon."
      action={
        <Button variant="primary" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      }
    />
  );
}
