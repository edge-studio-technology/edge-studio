import { useState } from "react";
import { Eye } from "lucide-react";
import { JsonPreviewContent } from "../../components/JsonPreview";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ToastProvider";
import { getJson } from "../../lib/api";

/** Fetches the feedback export fresh on each click, so the audit view never shows stale data. */
export function FeedbackAuditButton() {
  const { showToast } = useToast();
  const [data, setData] = useState<unknown>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function openAudit() {
    setLoading(true);
    try {
      const result = await getJson<unknown>("/api/feedback/export");
      setData(result);
      setOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load stored feedback.";
      showToast({ tone: "error", title: "Could not load stored feedback", message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" iconStart={<Eye aria-hidden />} disabled={loading} onClick={() => void openAudit()}>
        {loading ? "Loading..." : "View stored feedback"}
      </Button>
      {open && (
        <Modal title="Stored feedback (exact file contents)" onClose={() => setOpen(false)}>
          <JsonPreviewContent value={data} />
        </Modal>
      )}
    </>
  );
}
