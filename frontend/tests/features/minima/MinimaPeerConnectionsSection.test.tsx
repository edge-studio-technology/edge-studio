import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MinimaPeerConnectionsSection } from "../../../src/features/minima/MinimaPeerConnectionsSection";

describe("MinimaPeerConnectionsSection", () => {
  it("shows a loading empty state when there are no peers and peersLoading is true", () => {
    render(
      <MinimaPeerConnectionsSection
        peers={null}
        peersLoading
        peerslistInput=""
        setPeerslistInput={vi.fn()}
        busy={false}
        onAddPeers={vi.fn()}
      />,
    );
    expect(screen.getByText("Loading peer list…")).toBeInTheDocument();
    expect(screen.getByText("Peers (0)")).toBeInTheDocument();
  });

  it("shows a not-loading empty state message", () => {
    render(
      <MinimaPeerConnectionsSection
        peers={{ ok: true, count: 0, peers: [] }}
        peersLoading={false}
        peerslistInput=""
        setPeerslistInput={vi.fn()}
        busy={false}
        onAddPeers={vi.fn()}
      />,
    );
    expect(screen.getByText("No configured peers returned from Minima RPC.")).toBeInTheDocument();
  });

  it("renders each peer address and the count", () => {
    render(
      <MinimaPeerConnectionsSection
        peers={{ ok: true, count: 2, peers: ["host1:9001", "host2:9001"] }}
        peersLoading={false}
        peerslistInput=""
        setPeerslistInput={vi.fn()}
        busy={false}
        onAddPeers={vi.fn()}
      />,
    );
    expect(screen.getByText("Peers (2)")).toBeInTheDocument();
    expect(screen.getByText("host1:9001")).toBeInTheDocument();
    expect(screen.getByText("host2:9001")).toBeInTheDocument();
  });

  it("calls setPeerslistInput while typing", async () => {
    const user = userEvent.setup();
    const setPeerslistInput = vi.fn();
    render(
      <MinimaPeerConnectionsSection
        peers={null}
        peersLoading={false}
        peerslistInput=""
        setPeerslistInput={setPeerslistInput}
        busy={false}
        onAddPeers={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Peer address"), "h");
    expect(setPeerslistInput).toHaveBeenCalledWith("h");
  });

  it("disables Add peers when the input is blank, and calls onAddPeers when clicked", async () => {
    const user = userEvent.setup();
    const onAddPeers = vi.fn();
    const { rerender } = render(
      <MinimaPeerConnectionsSection
        peers={null}
        peersLoading={false}
        peerslistInput=""
        setPeerslistInput={vi.fn()}
        busy={false}
        onAddPeers={onAddPeers}
      />,
    );
    expect(screen.getByRole("button", { name: /add peers/i })).toBeDisabled();

    rerender(
      <MinimaPeerConnectionsSection
        peers={null}
        peersLoading={false}
        peerslistInput="host:9001"
        setPeerslistInput={vi.fn()}
        busy={false}
        onAddPeers={onAddPeers}
      />,
    );
    await user.click(screen.getByRole("button", { name: /add peers/i }));
    expect(onAddPeers).toHaveBeenCalledTimes(1);
  });
});
