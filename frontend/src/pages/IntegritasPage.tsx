import { useState } from "react";
import { JsonPreview } from "../components/patterns/JsonPreview";
import { Page } from "../components/patterns/Page";
import { useToast } from "../components/ToastProvider";
import { Card } from "../components/ui/Card";
import { TabList } from "../components/ui/TabList";
import { stampFile, verifyProofFile } from "../features/integritas/integritasApi";
import { integritasErrorToast } from "../features/integritas/integritasErrors";
import { StampFilePanel } from "../features/integritas/StampFilePanel";
import { StampResultCard } from "../features/integritas/StampResultCard";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { VerifyProofPanel } from "../features/integritas/VerifyProofPanel";

type IntegritasTab = "stamp" | "verify";

export function IntegritasPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<IntegritasTab>("stamp");
  const [stampUpload, setStampUpload] = useState<File | null>(null);
  const [verifyUpload, setVerifyUpload] = useState<File | null>(null);
  const [stampResultRecord, setStampResultRecord] = useState<IntegritasProofRecord | null>(null);
  const [stampResultDetails, setStampResultDetails] = useState<unknown>(null);
  const [verifyResult, setVerifyResult] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  function showIntegritasError(error: unknown) {
    const { title, message } = integritasErrorToast(error);
    showToast({ tone: "error", title, message, timeoutMs: 9000 });
  }

  async function run(action: () => Promise<unknown>, showResult = true) {
    setBusy(true);
    try {
      const response = await action();
      if (showResult) setResult(response);
      return response;
    } catch (err) {
      showIntegritasError(err);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Prove local data"
      desc="Stamp a local file to generate a timestamp proof. Verify an existing proof JSON when you need to check one."
    >
      <Card className="gap-detail-close flex w-full flex-col">
        <TabList
          label="Integritas actions"
          value={tab}
          options={[
            { value: "stamp", label: "Stamp a file" },
            { value: "verify", label: "Verify a proof file" },
          ]}
          onChange={setTab}
        />

        {tab === "stamp" ? (
          <StampFilePanel
            file={stampUpload}
            setFile={setStampUpload}
            busy={busy}
            onStamp={() =>
              run(async () => {
                if (!stampUpload) throw new Error("Select a file first");
                const response = await stampFile(stampUpload);
                setStampUpload(null);
                setStampResultRecord(response.record);
                setStampResultDetails(response);
                return response;
              }, false)
            }
          />
        ) : (
          <VerifyProofPanel
            file={verifyUpload}
            setFile={(file) => {
              setVerifyUpload(file);
              setVerifyResult(null);
            }}
            busy={busy}
            result={verifyResult}
            onVerifyFile={() =>
              run(async () => {
                if (!verifyUpload) throw new Error("Select a proof JSON file first");
                const response = await verifyProofFile(verifyUpload);
                setVerifyUpload(null);
                setVerifyResult(response);
                setResult(null);
                return response;
              }, false)
            }
          />
        )}
      </Card>

      {stampResultRecord && (
        <StampResultCard
          record={stampResultRecord}
          technicalDetails={stampResultDetails ?? undefined}
          onClose={() => {
            setStampResultRecord(null);
            setStampResultDetails(null);
          }}
        />
      )}

      {result !== null && <JsonPreview value={result} />}
    </Page>
  );
}
