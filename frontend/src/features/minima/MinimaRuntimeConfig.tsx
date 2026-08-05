import { Globe, Users } from "lucide-react";
import type { MinimaConfig, MinimaPeersResponse } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Input } from "../../components/Input";
import { ListDisclosure } from "../../components/patterns/ListDisclosure";
import { SubSection } from "../../components/patterns/SubSection";

function ConfigDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-3">
      <dt className="m-0 text-sm font-medium text-slate-500">{label}</dt>
      <dd className="m-0 min-w-0 font-mono text-sm text-slate-800 break-all">{value}</dd>
    </div>
  );
}

export function MinimaRuntimeConfig({
  config,
  megammrHostInput,
  setMegammrHostInput,
  peers,
  peersLoading,
  peerslistInput,
  setPeerslistInput,
  busy,
  onSave,
  onAddPeers
}: {
  config: MinimaConfig | null;
  megammrHostInput: string;
  setMegammrHostInput: (value: string) => void;
  peers: MinimaPeersResponse | null;
  peersLoading: boolean;
  peerslistInput: string;
  setPeerslistInput: (value: string) => void;
  busy: boolean;
  onSave: () => void;
  onAddPeers: () => void;
}) {
  const peerItems = peers?.peers ?? [];

  return (
    <div className="grid min-w-0 gap-6">
      <SubSection
        icon={<Globe size={13} />}
        title="Megammr host"
        description="Runtime sync host configuration used by this node."
      >
        <div className="grid gap-4">
          <div className="grid min-w-[min(100%,360px)] gap-2.5">
            <Input
              value={megammrHostInput}
              onChange={(event) => setMegammrHostInput(event.target.value)}
              placeholder="megammr.minima.global:9001"
              aria-label="Megammr host"
            />
            <ButtonRow>
              <Button type="button" disabled={busy || !megammrHostInput.trim()} onClick={onSave}>
                Save configuration
              </Button>
            </ButtonRow>
          </div>

          <dl className="m-0 grid gap-3 border-t border-slate-200 pt-4">
            <ConfigDetail label="megammrHost" value={config?.megammrHost ?? "loading..."} />
            <ConfigDetail label="megammrHostSource" value={config?.megammrHostSource ?? "loading..."} />
          </dl>
        </div>
      </SubSection>

      <SubSection
        icon={<Users size={13} />}
        title="Peer connections"
        description="Manage the peers this node connects to."
      >
        <div className="grid gap-4">
          <div className="grid min-w-[min(100%,360px)] gap-2.5">
            <Input
              value={peerslistInput}
              onChange={(event) => setPeerslistInput(event.target.value)}
              placeholder="host:port or host:port,host:port"
              aria-label="Peer address"
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
                <p key={peer} className="m-0 truncate text-sm text-slate-700">
                  <code className="text-slate-800">{peer}</code>
                </p>
              ))
            ) : (
              <p className="m-0 text-sm text-slate-500">
                {peersLoading ? "Loading peer list…" : "No configured peers returned from Minima RPC."}
              </p>
            )}
          </ListDisclosure>
        </div>
      </SubSection>
    </div>
  );
}
