import { Users } from "lucide-react";
import type { MinimaPeersResponse } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { ListDisclosure } from "../../components/patterns/ListDisclosure";
import { SubSection } from "../../components/patterns/SubSection";
import { InputField } from "../../components/ui/InputField";

export function MinimaPeerConnectionsSection({
  peers,
  peersLoading,
  peerslistInput,
  setPeerslistInput,
  busy,
  onAddPeers
}: {
  peers: MinimaPeersResponse | null;
  peersLoading: boolean;
  peerslistInput: string;
  setPeerslistInput: (value: string) => void;
  busy: boolean;
  onAddPeers: () => void;
}) {
  const peerItems = peers?.peers ?? [];

  return (
    <SubSection
      icon={<Users size={13} />}
      title="Peer connections"
      description="Manage the peers this node connects to."
    >
      <div className="grid gap-4">
        <div className="grid min-w-[min(100%,360px)] gap-2.5">
          <InputField
            label="Peer address"
            value={peerslistInput}
            onChange={(event) => setPeerslistInput(event.target.value)}
            placeholder="host:port or host:port,host:port"
          />
          <ButtonRow>
            <Button type="button" disabled={busy || !peerslistInput.trim()} onClick={onAddPeers}>
              Add peers
            </Button>
          </ButtonRow>
        </div>

        <p className="m-0 text-xs text-slate-500">
          Active peer count on the health card reflects live P2P connections, not this list.
        </p>

        <ListDisclosure title="Peers" count={peerItems.length}>
          {peerItems.length > 0 ? (
            peerItems.map((peer) => (
              <p key={peer} className="m-0 truncate px-3 py-2 text-sm text-slate-700">
                <code className="text-slate-800">{peer}</code>
              </p>
            ))
          ) : (
            <p className="m-0 px-3 py-2 text-sm text-slate-500">
              {peersLoading ? "Loading peer list…" : "No configured peers returned from Minima RPC."}
            </p>
          )}
        </ListDisclosure>
      </div>
    </SubSection>
  );
}
