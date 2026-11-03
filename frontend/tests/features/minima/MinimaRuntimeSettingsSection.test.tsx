import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { MinimaRuntimeSettingsSection } from "../../../src/features/minima/MinimaRuntimeSettingsSection";

const settings = {
  healthPollIntervalSeconds: 60,
  stallBlockAgeSeconds: 300,
  autoResyncEnabled: false,
  autoResyncCooldownMinutes: 30,
};
const limits = {
  healthPollIntervalSeconds: { min: 10, max: 3600 },
  stallBlockAgeSeconds: { min: 60, max: 86400 },
  autoResyncCooldownMinutes: { min: 1, max: 10080 },
};
const fetchMock = vi.fn();
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(response({ settings, limits }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("loads and saves monitoring settings through the backend without Minima RPC", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response({ settings, limits }))
    .mockResolvedValueOnce(
      response({
        settings: { ...settings, autoResyncEnabled: true, healthPollIntervalSeconds: 120 },
        limits,
      }),
    );
  render(<MinimaRuntimeSettingsSection />, { wrapper: ToastProvider });
  const interval = await screen.findByLabelText("Health-check interval (seconds)");
  expect(interval).toHaveValue(60);
  await user.clear(interval);
  await user.type(interval, "120");
  await user.click(screen.getByLabelText("Automatically resync a stalled node"));
  await user.click(screen.getByRole("button", { name: "Save monitoring settings" }));
  await screen.findByText("Monitoring settings saved");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0]).toEqual([
    "/api/minima/monitoring/settings",
    { credentials: "include" },
  ]);
  const [url, options] = fetchMock.mock.calls[1];
  expect(url).toBe("/api/minima/monitoring/settings");
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual({
    ...settings,
    healthPollIntervalSeconds: 120,
    autoResyncEnabled: true,
  });
  expect(screen.getByLabelText("Automatically resync a stalled node")).toBeChecked();
});

it("rejects empty and out-of-range fields before saving", async () => {
  const user = userEvent.setup();
  render(<MinimaRuntimeSettingsSection />, { wrapper: ToastProvider });
  const interval = await screen.findByLabelText("Health-check interval (seconds)");
  await user.clear(interval);
  await user.click(screen.getByRole("button", { name: "Save monitoring settings" }));
  expect(screen.getByText("Enter a whole number from 10 to 3600.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await user.type(interval, "3601");
  await user.click(screen.getByRole("button", { name: "Save monitoring settings" }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("offers retry after a load failure", async () => {
  const user = userEvent.setup();
  fetchMock.mockRejectedValueOnce(new Error("settings unavailable"));
  render(<MinimaRuntimeSettingsSection />, { wrapper: ToastProvider });
  await screen.findByText("settings unavailable");
  expect(
    screen.queryByRole("button", { name: "Save monitoring settings" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByLabelText("Health-check interval (seconds)")).toHaveValue(60);
});

it("keeps edits available when a save fails", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response({ settings, limits }))
    .mockRejectedValueOnce(new Error("save unavailable"));
  render(<MinimaRuntimeSettingsSection />, { wrapper: ToastProvider });
  const interval = await screen.findByLabelText("Health-check interval (seconds)");
  await user.clear(interval);
  await user.type(interval, "120");
  await user.click(screen.getByRole("button", { name: "Save monitoring settings" }));
  await screen.findByText("save unavailable");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save monitoring settings" })).not.toBeDisabled(),
  );
  expect(interval).toHaveValue(120);
});
