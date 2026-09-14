import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackModal } from "../../../src/features/feedback/FeedbackModal";
import { ToastProvider } from "../../../src/components/ToastProvider";

const getJson = vi.fn();
const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

type FeedbackConfig = {
  hostedFeedbackEnabled: boolean;
  hostedFeedbackAvailable: boolean;
  integritasApiKeyConfigured: boolean;
  endpoint: string;
};

type FeedbackExportDoc = {
  metadata: {
    app: { version: string };
    user: { id: string; displayName: string; role: string };
    device: {
      id: string;
      hostname: string;
      platform: string;
      arch: string;
      cpuCount: number;
      memory: { totalBytes: number };
      disk: { totalBytes: number } | null;
    };
    integritasAccount: { userId: string | null };
  };
};

const availableConfig: FeedbackConfig = {
  hostedFeedbackEnabled: true,
  hostedFeedbackAvailable: true,
  integritasApiKeyConfigured: true,
  endpoint: "https://feedback.example/api",
};

const sampleExportDoc: FeedbackExportDoc = {
  metadata: {
    app: { version: "1.2.3" },
    user: { id: "u1", displayName: "Ada", role: "admin" },
    device: {
      id: "dev1",
      hostname: "raspberrypi",
      platform: "linux",
      arch: "arm64",
      cpuCount: 4,
      memory: { totalBytes: 2 * 1024 ** 3 },
      disk: { totalBytes: 512 * 1024 ** 2 },
    },
    integritasAccount: { userId: "acct-1" },
  },
};

function mockLoad({
  exportDoc = sampleExportDoc as FeedbackExportDoc | "reject",
  config = availableConfig as FeedbackConfig | "reject",
}: {
  exportDoc?: FeedbackExportDoc | "reject";
  config?: FeedbackConfig | "reject";
} = {}) {
  getJson.mockImplementation((url: string) => {
    if (url === "/api/feedback/export") {
      return exportDoc === "reject" ? Promise.reject(new Error("export failed")) : Promise.resolve(exportDoc);
    }
    if (url === "/api/feedback/config") {
      return config === "reject" ? Promise.reject(new Error("config failed")) : Promise.resolve(config);
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}

function renderModal(props: Partial<{ pagePath: string; pageLabel: string; onClose: () => void }> = {}) {
  const onClose = props.onClose ?? vi.fn();
  render(
    <FeedbackModal
      pagePath={props.pagePath ?? "/dashboard"}
      pageLabel={props.pageLabel ?? "Dashboard"}
      onClose={onClose}
    />,
    { wrapper: ToastProvider },
  );
  return onClose;
}

async function openWhatWeSaveDisclosure() {
  await userEvent.click(screen.getByText("What we save with this feedback"));
}

beforeEach(() => {
  getJson.mockReset();
  postJson.mockReset();
  mockLoad();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FeedbackModal", () => {
  it("renders the page context, default bug fields, and pre-submit message once config loads", async () => {
    renderModal({ pagePath: "/wallet", pageLabel: "Wallet" });

    expect(screen.getByText("Send feedback")).toBeInTheDocument();
    expect(screen.getByText("Wallet", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("/wallet")).toBeInTheDocument();

    expect(await screen.findByText("Feedback will be sent to Integritas.")).toBeInTheDocument();

    expect(screen.getByLabelText("Severity")).toBeInTheDocument();
    expect(screen.getByLabelText("Reproducibility")).toBeInTheDocument();
    expect(screen.getByLabelText("Expected behavior")).toBeInTheDocument();
    expect(screen.getByLabelText("Actual behavior")).toBeInTheDocument();
    expect(screen.queryByLabelText("Priority")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Desired outcome")).not.toBeInTheDocument();
  });

  it("shows exported device/account metadata inside the what-we-save disclosure", async () => {
    renderModal();
    await screen.findByText("Feedback will be sent to Integritas.");
    await openWhatWeSaveDisclosure();

    expect(screen.getByText(navigator.userAgent)).toBeInTheDocument();
    expect(screen.getByText(navigator.language)).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("Ada (admin)")).toBeInTheDocument();
    expect(screen.getByText("acct-1")).toBeInTheDocument();
    expect(screen.getByText("dev1")).toBeInTheDocument();
    expect(screen.getByText("raspberrypi")).toBeInTheDocument();
    expect(screen.getByText("linux / arm64")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2.0 GB")).toBeInTheDocument();
    expect(screen.getByText("512.0 MB")).toBeInTheDocument();
  });

  it("falls back to placeholders and disables submission when export/config fetches fail", async () => {
    mockLoad({ exportDoc: "reject", config: "reject" });
    renderModal();

    expect(await screen.findByText("Feedback delivery is unavailable.")).toBeInTheDocument();
    await openWhatWeSaveDisclosure();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    expect(screen.getByRole("checkbox", { name: /I agree to send this feedback/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("shows the Integritas API key message when hosted feedback is enabled but not configured", async () => {
    mockLoad({
      config: { hostedFeedbackEnabled: true, hostedFeedbackAvailable: false, integritasApiKeyConfigured: false, endpoint: "" },
    });
    renderModal();

    expect(
      await screen.findByText("Feedback requires an Integritas API key before it can be submitted."),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /I agree to send this feedback/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("switches type-specific fields between bug, feature request, and neither", async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Feedback will be sent to Integritas.");

    await user.selectOptions(screen.getByLabelText("Feedback type"), "feature_request");
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Desired outcome")).toBeInTheDocument();
    expect(screen.queryByLabelText("Severity")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Feedback type"), "question");
    expect(screen.queryByLabelText("Priority")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Severity")).not.toBeInTheDocument();
  });

  it("requires a description before submitting", async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Feedback will be sent to Integritas.");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Describe the feedback before submitting.")).toBeInTheDocument();
    expect(postJson).not.toHaveBeenCalled();
  });

  it("requires hosted consent before submitting, and clears the error once checked", async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Feedback will be sent to Integritas.");

    await user.type(screen.getByLabelText("Description"), "Something broke");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Confirm consent before sending feedback to Integritas."),
    ).toBeInTheDocument();
    expect(postJson).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: /I agree to send this feedback/ }));
    expect(
      screen.queryByText("Confirm consent before sending feedback to Integritas."),
    ).not.toBeInTheDocument();
  });

  it("submits the bug payload and shows the sent outcome", async () => {
    const user = userEvent.setup();
    postJson.mockResolvedValue({
      id: "fb-1",
      remoteDelivery: {
        status: "sent",
        remoteId: "r-1",
        endpoint: "https://feedback.example/api",
        lastAttemptAt: null,
        lastSuccessAt: null,
        attemptCount: 1,
        lastError: null,
      },
    });
    const onClose = renderModal({ pagePath: "/wallet", pageLabel: "Wallet" });
    await screen.findByText("Feedback will be sent to Integritas.");

    await user.type(screen.getByLabelText("Description"), "  Something broke  ");
    await user.click(screen.getByRole("checkbox", { name: /I agree to send this feedback/ }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findAllByText("Feedback submitted")).not.toHaveLength(0);
    expect(screen.getAllByText("Feedback was sent to Integritas.").length).toBeGreaterThan(0);

    expect(postJson).toHaveBeenCalledWith("/api/feedback", {
      type: "bug",
      area: { id: "current_page", label: "Current page" },
      description: "Something broke",
      page: { path: "/wallet", label: "Wallet" },
      bug: {
        severity: "medium",
        reproducibility: "not_sure",
        expectedBehavior: "",
        actualBehavior: "",
      },
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
      },
      hostedConsent: true,
    });

    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("submits the feature_request payload without bug fields", async () => {
    const user = userEvent.setup();
    postJson.mockResolvedValue({
      id: "fb-2",
      remoteDelivery: {
        status: "pending",
        remoteId: null,
        endpoint: "https://feedback.example/api",
        lastAttemptAt: null,
        lastSuccessAt: null,
        attemptCount: 1,
        lastError: null,
      },
    });
    renderModal();
    await screen.findByText("Feedback will be sent to Integritas.");

    await user.selectOptions(screen.getByLabelText("Feedback type"), "feature_request");
    await user.type(screen.getByLabelText("Desired outcome"), "Faster exports");
    await user.type(screen.getByLabelText("Description"), "Would love this");
    await user.click(screen.getByRole("checkbox", { name: /I agree to send this feedback/ }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findAllByText("Feedback not submitted")).not.toHaveLength(0);
    expect(
      screen.getAllByText("Feedback could not reach Integritas. Try again later.").length,
    ).toBeGreaterThan(0);

    const payload = postJson.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.featureRequest).toEqual({ priority: "nice_to_have", desiredOutcome: "Faster exports" });
    expect(payload.bug).toBeUndefined();
  });

  it("shows a warning outcome when remote delivery is not enabled", async () => {
    const user = userEvent.setup();
    postJson.mockResolvedValue({
      id: "fb-3",
      remoteDelivery: {
        status: "not_enabled",
        remoteId: null,
        endpoint: "",
        lastAttemptAt: null,
        lastSuccessAt: null,
        attemptCount: 0,
        lastError: null,
      },
    });
    renderModal();
    await screen.findByText("Feedback will be sent to Integritas.");

    await user.type(screen.getByLabelText("Description"), "Question about setup");
    await user.click(screen.getByRole("checkbox", { name: /I agree to send this feedback/ }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findAllByText("Feedback not submitted")).not.toHaveLength(0);
    expect(
      screen.getAllByText("Feedback requires an Integritas API key before it can be submitted.").length,
    ).toBeGreaterThan(0);
  });

  it("shows an error toast and inline error, and keeps the form open, when submission fails", async () => {
    const user = userEvent.setup();
    postJson.mockRejectedValue(new Error("Server exploded"));
    renderModal();
    await screen.findByText("Feedback will be sent to Integritas.");

    await user.type(screen.getByLabelText("Description"), "Something broke");
    await user.click(screen.getByRole("checkbox", { name: /I agree to send this feedback/ }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Feedback was not saved")).toBeInTheDocument();
    const errorTexts = await screen.findAllByText("Server exploded");
    expect(errorTexts.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = renderModal();
    await screen.findByText("Feedback will be sent to Integritas.");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
