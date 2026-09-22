import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataSourceRead } from "../../src/features/data-reads/dataReadTypes";
import type {
  IntegritasHistoryPage,
  IntegritasProofRecord,
} from "../../src/features/integritas/integritasTypes";
import { DashboardPage } from "../../src/pages/DashboardPage";

const getHistory = vi.fn();
const listDataReads = vi.fn();
const useIntegritasHistoryAutoRefresh = vi.fn();

vi.mock("../../src/features/dashboard/DashboardNextAction", () => ({
  DashboardNextAction: () => null,
}));

vi.mock("../../src/features/dashboard/DashboardDevices", () => ({
  DashboardDevices: () => null,
}));

vi.mock("../../src/features/integritas/integritasApi", () => ({
  getHistory: (...args: unknown[]) => getHistory(...args),
}));

vi.mock("../../src/features/data-reads/dataReadsApi", () => ({
  listDataReads: (...args: unknown[]) => listDataReads(...args),
}));

vi.mock("../../src/features/integritas/useIntegritasHistoryAutoRefresh", () => ({
  useIntegritasHistoryAutoRefresh: (...args: unknown[]) =>
    useIntegritasHistoryAutoRefresh(...args),
}));

function proof(
  id: string,
  createdAt: string,
  overrides: Partial<IntegritasProofRecord> = {},
): IntegritasProofRecord {
  return {
    id,
    created_at: createdAt,
    updated_at: createdAt,
    file_name: `Proof ${id}`,
    file_size: 100,
    hash: `hash-${id}`,
    proof_uid: `uid-${id}`,
    proof_status: "ready",
    proof_payload: null,
    status_response: null,
    verify_response: null,
    verification_report_file: null,
    proof_error: null,
    ...overrides,
  };
}

function read(
  id: string,
  createdAt: string,
  overrides: Partial<DataSourceRead> = {},
): DataSourceRead {
  return {
    id,
    createdAt,
    dataSourceId: `source-${id}`,
    workflowId: null,
    integritasProofId: null,
    sourceName: `Device ${id}`,
    sourceUrl: "https://example.com/data",
    triggerType: "manual",
    status: "success",
    hash: null,
    preview: null,
    error: null,
    triggerSourceId: null,
    triggerPayload: null,
    blockId: null,
    ...overrides,
  };
}

function historyPage(items: IntegritasProofRecord[] = []): IntegritasHistoryPage {
  return {
    items,
    page: 1,
    pageSize: 100,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    pendingTotal: items.filter((item) => item.proof_status === "pending").length,
  };
}

function readsPage(items: DataSourceRead[] = []) {
  return {
    items,
    page: 1,
    pageSize: 100,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("DashboardPage Live activity", () => {
  beforeEach(() => {
    getHistory.mockReset();
    listDataReads.mockReset();
    useIntegritasHistoryAutoRefresh.mockReset();
  });

  it("shows loading instead of empty content while both requests are pending", () => {
    getHistory.mockReturnValue(new Promise(() => {}));
    listDataReads.mockReturnValue(new Promise(() => {}));

    render(<DashboardPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Fetching live activity");
    expect(screen.queryByText("No live activity yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows shared empty content after both requests succeed without activity", async () => {
    getHistory.mockResolvedValue(historyPage());
    listDataReads.mockResolvedValue(readsPage());

    render(<DashboardPage />);

    expect(await screen.findByText("No live activity yet")).toBeInTheDocument();
    expect(screen.getByText("Proofs and data reads will appear here as they happen.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders proof and read activity newest first and caps the list at ten items", async () => {
    const proofs = Array.from({ length: 6 }, (_, index) =>
      proof(String(index + 1), `2026-09-22T10:${String(index).padStart(2, "0")}:00.000Z`),
    );
    const reads = Array.from({ length: 6 }, (_, index) =>
      read(String(index + 1), `2026-09-22T11:${String(index).padStart(2, "0")}:00.000Z`, {
        triggerType: index === 5 ? "mqtt" : "manual",
        status: index === 4 ? "failed" : "success",
      }),
    );
    getHistory.mockResolvedValue(historyPage(proofs));
    listDataReads.mockResolvedValue(readsPage(reads));

    render(<DashboardPage />);

    await screen.findByText("Device 6 MQTT message received");
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(10);
    expect(within(articles[0]).getByText("Device 6 MQTT message received")).toBeInTheDocument();
    expect(within(articles[1]).getByText("Device 5 manual read")).toBeInTheDocument();
    expect(within(articles[1]).getByText("Failed")).toBeInTheDocument();
    expect(within(articles[6]).getByText("Attestation created for Proof 6")).toBeInTheDocument();
    expect(screen.queryByText("Attestation created for Proof 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Attestation created for Proof 2")).not.toBeInTheDocument();
  });

  it.each([
    ["proof history", "proofs"],
    ["data reads", "reads"],
  ])("shows a shared error without loading, empty, or rows when %s fails", async (_label, failure) => {
    getHistory.mockResolvedValue(historyPage());
    listDataReads.mockResolvedValue(readsPage());
    if (failure === "proofs") {
      getHistory.mockRejectedValue(new Error("Proof history failed"));
    } else {
      listDataReads.mockRejectedValue(new Error("Data reads failed"));
    }

    render(<DashboardPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load live activity");
    expect(alert).toHaveTextContent(
      failure === "proofs" ? "Proof history failed" : "Data reads failed",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("No live activity yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("retries both requests, re-enters loading, and renders recovered activity", async () => {
    const retryHistory = deferred<IntegritasHistoryPage>();
    const retryReads = deferred<ReturnType<typeof readsPage>>();
    getHistory
      .mockRejectedValueOnce(new Error("Proof history failed"))
      .mockReturnValueOnce(retryHistory.promise);
    listDataReads.mockResolvedValueOnce(readsPage()).mockReturnValueOnce(retryReads.promise);

    render(<DashboardPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(screen.getByRole("status")).toHaveTextContent("Fetching live activity");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(getHistory).toHaveBeenCalledTimes(2);
    expect(listDataReads).toHaveBeenCalledTimes(2);

    retryHistory.resolve(historyPage([proof("recovered", "2026-09-22T12:00:00.000Z")]));
    retryReads.resolve(readsPage());

    expect(await screen.findByText("Attestation created for Proof recovered")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
