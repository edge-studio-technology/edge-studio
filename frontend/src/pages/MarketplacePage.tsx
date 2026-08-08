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
      description="The marketplace is on its way. Check back soon for new integrations and add-ons."
      action={
        <Button variant="primary" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      }
    />
  );
}
