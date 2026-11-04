import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WalletPage } from "../../src/pages/WalletPage";
import { sendPayment } from "../../src/features/wallet/walletApi";

vi.mock("../../src/features/wallet/WalletHistoryPanel", () => ({
  WalletHistoryPanel: ({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) => <div>{loading ? "History loading" : "History ready"}<button onClick={onRefresh}>Refresh history</button></div>,
}));
vi.mock("../../src/features/wallet/SendPaymentModal", () => ({
  SendPaymentModal: ({ onClose }: { onClose: () => void }) => <button onClick={async () => { await sendPayment({ address: "Mxrecipient", amount: "1" }); onClose(); }}>Confirm test payment</button>,
}));

const status = {
  checkedAt: "2026-11-03T12:00:00.000Z", state: "running", rpc: { ok: true }, container: null,
  sync: { synced: true, status: "active", block: 1, blockTime: null, blockAgeSeconds: 1 },
  health: { peerCount: 1, peersKnown: 1 }, node: { memoryRam: null, memoryDisk: null },
  storage: { dataPath: "/data", containerDisk: null, chainDataDisk: null }, config: {}, monitoring: {},
};
const fetchMock = vi.fn();
let paid = false;
function response(value: unknown) { return new Response(JSON.stringify(value), { status: 200 }); }
beforeEach(() => {
  paid = false;
  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/minima/status") return response(status);
    if (url === "/api/wallet") return response({ checkedAt: status.checkedAt, tokens: [{ tokenId: "0x00", name: "Minima", confirmed: paid ? "11.5" : "12.5", sendable: paid ? "11.5" : "12.5", unconfirmed: "0", isNative: true }] });
    if (url.startsWith("/api/wallet/history")) return response({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0, previousWalletItems: 0 });
    if (url === "/api/wallet/send-payment" && init?.method === "POST") { paid = true; return response({ ok: true }); }
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("renders retained balance/history immediately on return without new requests within the window", async () => {
  const first = render(<WalletPage />);
  await screen.findByText("12.5");
  await screen.findByText("History ready");
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
  const calls = fetchMock.mock.calls.length;
  first.unmount();
  fetchMock.mockImplementation(() => new Promise(() => {}));
  render(<WalletPage />);
  expect(screen.getByText("12.5")).toBeInTheDocument();
  expect(screen.getByText("History ready")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
  expect(fetchMock).toHaveBeenCalledTimes(calls);
});

it("bypasses reuse on manual refresh and reloads balance immediately after a payment", async () => {
  const user = userEvent.setup();
  render(<WalletPage />);
  await screen.findByText("12.5");
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
  const historyReads = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/wallet/history")).length;
  const before = historyReads();
  await user.click(screen.getByRole("button", { name: "Refresh history" }));
  expect(historyReads()).toBe(before + 1);
  await user.click(screen.getByRole("button", { name: "Send" }));
  await user.click(screen.getByRole("button", { name: "Confirm test payment" }));
  expect(await screen.findByText("11.5")).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([url]) => url === "/api/wallet").length).toBeGreaterThan(1);
});
