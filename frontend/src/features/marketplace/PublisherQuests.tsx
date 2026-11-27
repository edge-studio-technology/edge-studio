// The publisher's side of funded data quests in the Marketplace module (#1380, Edge Studio Data Marketplace V1).
// Shown on the Marketplace page's "Quests" tab:
//   Open quests     funded quests anyone can contribute to; ask for a slot with one of your verified sources
//   My quest slots  your requests (waiting, declined) and the slots the buyer gave you: say when collection has
//                   started (from then on a cancelled quest keeps your slot until its deadline), and open a dispute
//                   about an award during the hold period; deliver a file for the slot (signed by this node)
// Everything goes through Edge Studio's backend (GET/POST /api/marketplace/quests...), which holds the installation
// key; the marketplace enforces every rule and its answer is shown as it is.
import { useCallback, useEffect, useRef, useState } from "react";
import { Target } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { LoadingState } from "../../components/patterns/LoadingState";
import { useToast } from "../../components/ToastProvider";
import type { ApiError } from "../../lib/api";
import { describeLoadFailure } from "../../lib/errors";
import {
  canPublish,
  centsText,
  disputeQuestSlot,
  getMyQuestClaims,
  getOpenQuests,
  getPublisherSources,
  requestQuestSlot,
  startQuestCollection,
  submitQuestDeliveryFile,
  utcText,
  type MarketplaceRole,
  type OpenQuest,
  type PublisherSource,
  type QuestClaim,
  type QuestDelivery,
} from "./marketplaceApi";

const failureText = (failure: unknown) =>
  failure instanceof Error ? failure.message : "The marketplace refused the request.";

export function PublisherQuests({ role }: { role: MarketplaceRole }) {
  const [data, setData] = useState<{
    quests: OpenQuest[];
    claims: QuestClaim[];
    sources: PublisherSource[];
  } | null>(null);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const mayAct = canPublish(role);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [quests, claims, sources] = await Promise.all([
        getOpenQuests(),
        getMyQuestClaims(),
        getPublisherSources(),
      ]);
      setData({ quests, claims, sources });
    } catch (failure) {
      setError(
        (failure as ApiError).status === 503
          ? {
              title: "Marketplace service unavailable",
              description:
                "Edge Studio could not reach the marketplace. Everything else in Edge Studio keeps working; try again in a moment.",
            }
          : { title: "Could not load quests", description: describeLoadFailure(failure) },
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <ErrorContentState
        title={error.title}
        description={error.description}
        onRetry={() => void load()}
      />
    );
  if (!data) return <LoadingState />;
  const verified = data.sources.filter((s) => s.selectable);
  return (
    <div className="gap-detail-close flex flex-col">
      <section aria-label="Open quests" className="gap-detail-close flex flex-col">
        <h2 className="type-title text-text-primary m-0">Open quests</h2>
        {data.quests.length === 0 ? (
          <EmptyContentState
            icon={Target}
            title="No open quests"
            description="Funded quests from buyers appear here."
          />
        ) : (
          data.quests.map((q) => (
            <OpenQuestItem key={q.id} quest={q} sources={verified} mayAct={mayAct} onDone={load} />
          ))
        )}
      </section>
      <section aria-label="My quest slots" className="gap-detail-close flex flex-col">
        <h2 className="type-title text-text-primary m-0">My quest slots</h2>
        {data.claims.length === 0 ? (
          <p className="type-body text-text-secondary m-0">
            You have not asked for any quest slot yet.
          </p>
        ) : (
          data.claims.map((c) => (
            <ClaimItem key={c.claimId} claim={c} mayAct={mayAct} onDone={load} />
          ))
        )}
      </section>
    </div>
  );
}

function OpenQuestItem({
  quest,
  sources,
  mayAct,
  onDone,
}: {
  quest: OpenQuest;
  sources: PublisherSource[];
  mayAct: boolean;
  onDone: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  // One key per intended request, kept across retries, so a retried request is the same request (TC-QST-12).
  const key = useRef<string>(crypto.randomUUID());
  const title = quest.title ?? "Untitled quest";

  async function ask() {
    setMessage(null);
    try {
      await requestQuestSlot(quest.id, sourceId, key.current);
      key.current = crypto.randomUUID(); // done: a later request is a new one
      showToast({
        tone: "success",
        title: "Slot requested",
        message: "The buyer decides; you are told by email.",
      });
      await onDone();
    } catch (failure) {
      setMessage(failureText(failure));
    }
  }

  return (
    <article className="border-stroke-primary rounded border p-3">
      <h3 className="type-body-em text-text-primary m-0">{title}</h3>
      <p className="type-body text-text-secondary m-0">
        {`${quest.progress.unclaimed} of ${quest.progress.total} slots open · ${quest.rewardCents === null ? "no reward set" : centsText(quest.rewardCents)} per slot · deadline ${utcText(quest.deadline)}`}
      </p>
      <p className="type-body text-text-primary m-0 whitespace-pre-wrap">{quest.criteria}</p>
      {mayAct && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="type-body text-text-primary flex flex-col">
            {`Source for ${title}`}
            <select
              className="border-stroke-primary rounded border px-2 py-1"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => void ask()} disabled={!sourceId}>
            Ask for a slot
          </Button>
        </div>
      )}
      {message && (
        <p className="type-body text-text-error m-0" role="alert">
          {message}
        </p>
      )}
    </article>
  );
}

function ClaimItem({
  claim,
  mayAct,
  onDone,
}: {
  claim: QuestClaim;
  mayAct: boolean;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [delivered, setDelivered] = useState<QuestDelivery | null>(null);
  const [busy, setBusy] = useState(false);
  const title = claim.questTitle ?? "Untitled quest";
  const status =
    claim.status === "requested"
      ? "Waiting for the buyer's decision"
      : claim.status === "declined"
        ? "Declined by the buyer"
        : `Slot ${claim.slot}: ${claim.slotState}`;

  async function run(action: () => Promise<unknown>, done: string) {
    setMessage(null);
    setBusy(true);
    try {
      await action();
      setMessage({ text: done, error: false });
      await onDone();
    } catch (failure) {
      setMessage({ text: failureText(failure), error: true });
    } finally {
      setBusy(false);
    }
  }
  // A delivery can be made while the slot is the publisher's and not yet accepted (also again after a rejection).
  const mayDeliver =
    mayAct &&
    claim.slot !== null &&
    claim.questStatus === "active" &&
    (claim.slotState === "committed" || claim.slotState === "rejected");

  return (
    <article className="border-stroke-primary rounded border p-3">
      <h3 className="type-body-em text-text-primary m-0">{title}</h3>
      <p className="type-body text-text-primary m-0">{status}</p>
      <p className="type-body text-text-secondary m-0">
        Source <span className="font-mono break-all">{claim.sourceId}</span> · deadline{" "}
        {utcText(claim.deadline)}
      </p>
      {mayAct &&
        claim.status === "accepted" &&
        claim.slot !== null &&
        claim.slotState === "committed" &&
        !claim.collectionStarted &&
        claim.questStatus === "active" && (
          <Button
            className="mt-2"
            onClick={() =>
              void run(
                () => startQuestCollection(claim.questId, claim.slot!),
                "Noted: collection has started.",
              )
            }
          >
            Collection has started
          </Button>
        )}
      {mayAct && claim.slot !== null && claim.slotState === "accepted" && (
        <div className="mt-2 flex flex-col gap-1">
          <label className="type-body text-text-primary flex flex-col">
            {`Reason for a dispute about ${title}, slot ${claim.slot}`}
            <textarea
              className="border-stroke-primary rounded border px-2 py-1"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div>
            <Button
              disabled={reason.trim().length < 5}
              onClick={() =>
                void run(
                  () => disputeQuestSlot(claim.questId, claim.slot!, reason.trim()),
                  "Dispute opened: the operator decides.",
                )
              }
            >
              Open a dispute
            </Button>
          </div>
        </div>
      )}
      {mayDeliver && (
        <div className="mt-2 flex flex-col gap-1">
          <label className="type-body text-text-primary flex flex-col">
            {`Delivery file for ${title}, slot ${claim.slot}`}
            <input
              type="file"
              accept=".ndjson,.jsonl,.json,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="type-body text-text-secondary m-0">
            NDJSON lines with a &quot;device_id&quot; field, or a CSV with a device_id column. Edge
            Studio counts the rows per device and this node signs the counts.
          </p>
          <div>
            <Button
              disabled={!file || busy}
              onClick={() =>
                void run(
                  async () =>
                    setDelivered(
                      await submitQuestDeliveryFile(
                        claim.questId,
                        claim.slot!,
                        claim.sourceId,
                        file!,
                      ),
                    ),
                  "Delivery submitted: the buyer reviews it.",
                )
              }
            >
              Sign and submit the delivery
            </Button>
          </div>
        </div>
      )}
      {delivered && (
        <div className="mt-2 flex flex-col gap-1">
          <p className="type-body text-text-primary m-0">
            Fingerprint (SHA3-256):{" "}
            <span className="font-mono break-all">{delivered.fingerprint}</span>
          </p>
          <ul className="type-body text-text-primary m-0">
            {Object.entries(delivered.counts).map(([device, n]) => (
              <li key={device}>{`${device}: ${n} rows`}</li>
            ))}
          </ul>
          <p className="type-body text-text-secondary m-0">
            Add this entry to your delivery service&apos;s DELIVERY_CONFIG &quot;files&quot; so the
            buyer can download it once accepted:
          </p>
          <pre className="type-body m-0 break-all whitespace-pre-wrap">
            {JSON.stringify(delivered.deliveryConfig, null, 2)}
          </pre>
        </div>
      )}
      {message && (
        <p
          className={`type-body m-0 ${message.error ? "text-text-error" : "text-text-primary"}`}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </article>
  );
}
