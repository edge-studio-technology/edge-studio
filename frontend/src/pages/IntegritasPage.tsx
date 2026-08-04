import { useState } from "react";
import { Page } from "../components/patterns/Page";
import { useToast } from "../components/ToastProvider";
import { Card } from "../components/ui/Card";
import { TabList } from "../components/ui/TabList";
import { stampFile, verifyProofFile } from "../features/integritas/integritasApi";
import { integritasErrorToast } from "../features/integritas/integritasErrors";
import { StampFilePanel } from "../features/integritas/StampFilePanel";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { VerifyProofPanel } from "../features/integritas/VerifyProofPanel";

type IntegritasTab = "stamp" | "verify";

type VerifySuccess = {
  response: unknown;
};

export function IntegritasPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<IntegritasTab>("stamp");
  const [stampUpload, setStampUpload] = useState<File | null>(null);
  const [verifyUpload, setVerifyUpload] = useState<File | null>(null);
  const [stampResultRecord, setStampResultRecord] = useState<IntegritasProofRecord | null>(null);
  const [stampResultDetails, setStampResultDetails] = useState<unknown>(null);
  const [verifyResult, setVerifyResult] = useState<VerifySuccess | null>(null);
  const [busy, setBusy] = useState(false);

  function showIntegritasError(error: unknown) {
    const { title, message } = integritasErrorToast(error);
    showToast({ tone: "error", title, message, timeoutMs: 9000 });
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      return await action();
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
            setFile={(file) => {
              setStampUpload(file);
              if (file) {
                setStampResultRecord(null);
                setStampResultDetails(null);
              }
            }}
            busy={busy}
            resultRecord={stampResultRecord}
            resultDetails={stampResultDetails}
            onClearResult={() => {
              setStampResultRecord(null);
              setStampResultDetails(null);
            }}
            onStamp={() =>
              run(async () => {
                if (!stampUpload) throw new Error("Select a file first");
                const response = await stampFile(stampUpload);
                setStampUpload(null);
                setStampResultRecord(response.record);
                setStampResultDetails(response);
                return response;
              })
            }
          />
        ) : (
          <VerifyProofPanel
            file={verifyUpload}
            setFile={(file) => {
              setVerifyUpload(file);
              if (file) setVerifyResult(null);
            }}
            busy={busy}
            result={verifyResult}
            onClearResult={() => setVerifyResult(null)}
            onVerifyFile={() =>
              run(async () => {
                if (!verifyUpload) throw new Error("Select a proof JSON file first");
                const response = await verifyProofFile(verifyUpload);
                setVerifyUpload(null);
                setVerifyResult({ response: response.response });
                return response;
              })
            }
          />
        )}
      </Card>
    </Page>
  );
}
