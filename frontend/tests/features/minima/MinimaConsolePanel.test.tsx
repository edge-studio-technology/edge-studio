import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MinimaConsolePanel } from "../../../src/features/minima/MinimaConsolePanel";

const runConsoleCommand = vi.fn();

vi.mock("../../../src/features/minima/minimaConsoleApi", () => ({
  runConsoleCommand: (...args: unknown[]) => runConsoleCommand(...args),
}));

describe("MinimaConsolePanel", () => {
  beforeEach(() => {
    runConsoleCommand.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an empty scrollback message initially", () => {
    render(<MinimaConsolePanel onEditWhitelist={vi.fn()} />);
    expect(screen.getByText("No commands run yet.")).toBeInTheDocument();
  });

  it("records an empty entry when Enter is pressed with no command text", async () => {
    const user = userEvent.setup();
    render(<MinimaConsolePanel onEditWhitelist={vi.fn()} />);
    const input = screen.getByPlaceholderText("status");
    await user.type(input, "{Enter}");
    expect(runConsoleCommand).not.toHaveBeenCalled();
    expect(screen.queryByText("No commands run yet.")).not.toBeInTheDocument();
  });

  it("runs a command, shows pending then the resulting payload", async () => {
    const user = userEvent.setup();
    let resolveCommand: (value: unknown) => void = () => {};
    runConsoleCommand.mockReturnValue(
      new Promise((resolve) => {
        resolveCommand = resolve;
      }),
    );
    render(<MinimaConsolePanel onEditWhitelist={vi.fn()} />);

    const input = screen.getByPlaceholderText("status");
    await user.type(input, "status{Enter}");

    expect(runConsoleCommand).toHaveBeenCalledWith("status");
    expect(screen.getByText("$ status")).toBeInTheDocument();

    resolveCommand({ ok: true, source: "minima", body: { response: { chain: "up" } } });

    await waitFor(() => expect(screen.getByText(/"chain": "up"/)).toBeInTheDocument());
  });

  it("shows an error message when the command fails", async () => {
    const user = userEvent.setup();
    runConsoleCommand.mockRejectedValue(new Error("not whitelisted"));
    render(<MinimaConsolePanel onEditWhitelist={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("status"), "status{Enter}");
    expect(await screen.findByText("not whitelisted")).toBeInTheDocument();
  });

  it("renders raw JSON when the payload has no body.response envelope", async () => {
    const user = userEvent.setup();
    runConsoleCommand.mockResolvedValue({ ok: true, source: "minima" });
    render(<MinimaConsolePanel onEditWhitelist={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("status"), "status{Enter}");
    expect(await screen.findByText(/"ok": true/)).toBeInTheDocument();
  });

  it("disables the input and shows an Unavailable placeholder when disabled", () => {
    render(<MinimaConsolePanel disabled onEditWhitelist={vi.fn()} />);
    const input = screen.getByPlaceholderText("Unavailable");
    expect(input).toBeDisabled();
  });

  it("clears the scrollback when the clear button is clicked", async () => {
    const user = userEvent.setup();
    runConsoleCommand.mockResolvedValue({ ok: true, source: "minima" });
    render(<MinimaConsolePanel onEditWhitelist={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("status"), "status{Enter}");
    await screen.findByText("$ status");

    await user.click(screen.getByRole("button", { name: /clear scrollback/i }));
    expect(screen.getByText("No commands run yet.")).toBeInTheDocument();
  });

  it("calls onEditWhitelist when the whitelist gear icon is clicked", async () => {
    const user = userEvent.setup();
    const onEditWhitelist = vi.fn();
    render(<MinimaConsolePanel onEditWhitelist={onEditWhitelist} />);
    await user.click(screen.getByRole("button", { name: /edit console command whitelist/i }));
    expect(onEditWhitelist).toHaveBeenCalledTimes(1);
  });

  it("toggles fullscreen mode and renders a second copy of the console via portal", async () => {
    const user = userEvent.setup();
    render(<MinimaConsolePanel onEditWhitelist={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /fullscreen/i }));
    expect(screen.getByRole("dialog", { name: /rpc console, fullscreen/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /exit fullscreen/i }));
    expect(screen.queryByRole("dialog", { name: /rpc console, fullscreen/i })).not.toBeInTheDocument();
  });

  it("exits fullscreen on Escape", async () => {
    const user = userEvent.setup();
    render(<MinimaConsolePanel onEditWhitelist={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /fullscreen/i }));
    expect(screen.getByRole("dialog", { name: /rpc console, fullscreen/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /rpc console, fullscreen/i })).not.toBeInTheDocument();
  });
});
