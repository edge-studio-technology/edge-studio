import { Cpu, Globe, Users } from "lucide-react";
import type { MinimaConfig, MinimaPeersResponse } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
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
  const peersSummary =
    peers?.count != null
      ? `${peers.count} configured`
      : peersLoading
        ? "Loading…"
        : "Unavailable";

  return (
    <div className="grid min-w-0 gap-6">
      <SubSection icon={<Cpu size={13} />} title="Runtime configuration">
        <dl className="m-0 grid gap-3">
          <ConfigDetail label="megammrHost" value={config?.megammrHost ?? "loading..."} />
          <ConfigDetail label="megammrHostSource" value={config?.megammrHostSource ?? "loading..."} />
        </dl>
      </SubSection>

      <SubSection icon={<Globe size={13} />} title="Megammr host">
        <div className="grid min-w-[min(100%,360px)] gap-2.5">
          <input
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
      </SubSection>

      <SubSection
        icon={<Users size={13} />}
        title={
          <span className="flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span>Peer connections</span>
            <span className="text-xs font-normal normal-case tracking-normal text-slate-500">{peersSummary}</span>
          </span>
        }
      >
        <div className="grid min-w-[min(100%,360px)] gap-2.5">
          <input
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

        {peerItems.length > 0 ? (
          <ul className="mt-4 mb-0 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-slate-700">
            {peerItems.map((peer) => (
              <li key={peer}>
                <code className="text-slate-800">{peer}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 mb-0 text-sm text-slate-500">
            {peersLoading ? "Loading peer list…" : "No configured peers returned from Minima RPC."}
          </p>
        )}

        <p className="mb-0 mt-3 text-xs leading-5 text-slate-500">
          Active peer count on the health card reflects live P2P connections, not this list.
        </p>
      </SubSection>
    </div>
  );
}
