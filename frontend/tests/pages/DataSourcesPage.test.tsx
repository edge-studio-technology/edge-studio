import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import type { DataSourceCapabilities } from "../../src/features/data-sources/dataSourceTypes";
import { DataSourcesPage } from "../../src/pages/DataSourcesPage";

const listDataSources = vi.fn();
const getDataSourceCapabilities = vi.fn();
const getHostCapabilities = vi.fn();

vi.mock("../../src/features/data-sources/dataSourcesApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/data-sources/dataSourcesApi")>()),
  listDataSources: (...args: unknown[]) => listDataSources(...args),
  getDataSourceCapabilities: (...args: unknown[]) => getDataSourceCapabilities(...args),
  getHostCapabilities: (...args: unknown[]) => getHostCapabilities(...args),
}));

const capabilities: DataSourceCapabilities = {
  gpioInput: {
    available: false,
    devicePath: "/dev/gpiochip0",
    reason: "Unavailable in tests",
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DataSourcesPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("DataSourcesPage", () => {
  beforeEach(() => {
    listDataSources.mockReset();
    getDataSourceCapabilities.mockReset();
    getHostCapabilities.mockReset();
    getHostCapabilities.mockResolvedValue({ items: [] });
  });

  it("shows loading without an error or empty state while required requests are pending", () => {
    listDataSources.mockReturnValue(new Promise(() => {}));
    getDataSourceCapabilities.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText("Fetching your devices")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect your first device")).not.toBeInTheDocument();
  });

  it.each([
    ["device list", "list"],
    ["device capabilities", "capabilities"],
  ])("shows a retryable error when the %s request fails", async (_label, failedRequest) => {
    listDataSources.mockResolvedValue({ items: [] });
    getDataSourceCapabilities.mockResolvedValue(capabilities);
    if (failedRequest === "list") {
      listDataSources.mockRejectedValue(new Error("Devices request failed"));
    } else {
      getDataSourceCapabilities.mockRejectedValue(new Error("Capabilities request failed"));
    }

    renderPage();

    expect(await screen.findByText("Devices aren't available")).toBeInTheDocument();
    expect(
      screen.getByText(
        failedRequest === "list" ? "Devices request failed" : "Capabilities request failed",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Fetching your devices")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect your first device")).not.toBeInTheDocument();
  });

  it("returns to loading on Retry and renders a genuine empty state after recovery", async () => {
    const retryList = deferred<{ items: [] }>();
    const retryCapabilities = deferred<DataSourceCapabilities>();
    listDataSources
      .mockRejectedValueOnce(new Error("Devices request failed"))
      .mockReturnValueOnce(retryList.promise);
    getDataSourceCapabilities
      .mockResolvedValueOnce(capabilities)
      .mockReturnValueOnce(retryCapabilities.promise);

    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(screen.getByText("Fetching your devices")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect your first device")).not.toBeInTheDocument();
    expect(listDataSources).toHaveBeenCalledTimes(2);
    expect(getDataSourceCapabilities).toHaveBeenCalledTimes(2);

    retryList.resolve({ items: [] });
    retryCapabilities.resolve(capabilities);

    expect(await screen.findByText("Connect your first device")).toBeInTheDocument();
    expect(screen.queryByText("Fetching your devices")).not.toBeInTheDocument();
  });

  it("keeps host capabilities best-effort when the required requests succeed", async () => {
    listDataSources.mockResolvedValue({ items: [] });
    getDataSourceCapabilities.mockResolvedValue(capabilities);
    getHostCapabilities.mockRejectedValue(new Error("Host capabilities unavailable"));

    renderPage();

    expect(await screen.findByText("Connect your first device")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(getHostCapabilities).toHaveBeenCalledOnce());
  });
});
