import { Users } from "lucide-react";
import type { MinimaPeersResponse } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import {
  DataTable,
  EmptyTableState,
  TableBody,
  TableCell,
  TableRow,
} from "../../components/DataTable";
import { SubSection } from "../../components/patterns/SubSection";
import { InputField } from "../../components/ui/InputField";
import { ScrollArea } from "../../components/ui/ScrollArea";

export function MinimaPeerConnectionsSection({
  peers,
  peersLoading,
  peerslistInput,
  setPeerslistInput,
  busy,
  onAddPeers,
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
        <div className="grid max-w-md gap-2.5">
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

        <div className="grid gap-2">
          <p className="m-0 text-sm font-medium text-slate-500">Peers ({peerItems.length})</p>
          <div className="rounded-loose border-stroke-primary bg-surface-always-white overflow-hidden border">
            <div className="bg-surface-secondary px-margin-tight py-margin-tight type-body-em text-text-primary">
              Address
            </div>
            <ScrollArea stableGutter={false} className="max-h-80">
              <DataTable aria-label="Peers">
                <TableBody>
                  {peerItems.length > 0 ? (
                    peerItems.map((peer) => (
                      <TableRow key={peer}>
                        <TableCell className="min-w-0">
                          <code className="text-text-primary truncate">{peer}</code>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell>
                        <EmptyTableState>
                          {peersLoading
                            ? "Loading peer list…"
                            : "No configured peers returned from Minima RPC."}
                        </EmptyTableState>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </DataTable>
            </ScrollArea>
          </div>
        </div>
      </div>
    </SubSection>
  );
}
