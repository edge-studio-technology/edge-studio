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
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { describeLoadFailure } from "../../lib/errors";
import {
  TableColumnVisibilityButton,
  type TableColumnDefinition,
} from "../../components/patterns/TableColumnVisibility";
import { TableControls } from "../../components/patterns/TableControls";
import { InputField } from "../../components/ui/InputField";
import { ScrollArea } from "../../components/ui/ScrollArea";
import { useTableColumnVisibility } from "../preferences/useTableColumnVisibility";

const PEER_COLUMNS = [
  { id: "address", label: "Address" },
] as const satisfies readonly TableColumnDefinition[];

export function MinimaPeerConnectionsSection({
  peers,
  peersLoading,
  peersError = null,
  peerslistInput,
  setPeerslistInput,
  busy,
  onAddPeers,
  onRetry = () => undefined,
}: {
  peers: MinimaPeersResponse | null;
  peersLoading: boolean;
  peersError?: string | null;
  peerslistInput: string;
  setPeerslistInput: (value: string) => void;
  busy: boolean;
  onAddPeers: () => void;
  onRetry?: () => void;
}) {
  const peerItems = peers?.peers ?? [];
  const { visibility, setVisibility } = useTableColumnVisibility("minima-peers", PEER_COLUMNS);

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
          {peersError ? null : (
            <TableControls
              utilities={
                <TableColumnVisibilityButton
                  tableLabel="Peers"
                  columns={PEER_COLUMNS}
                  visibility={visibility}
                  onChange={setVisibility}
                />
              }
            >
              <p className="m-0 text-sm font-medium text-slate-500">Peers ({peerItems.length})</p>
            </TableControls>
          )}
          {peersError ? (
            <ErrorContentState
              title="Peer list isn't available"
              description={describeLoadFailure(peersError)}
              onRetry={onRetry}
            />
          ) : (
            <div className="rounded-loose border-stroke-primary bg-surface-always-white overflow-hidden border">
              {visibility.address && (
                <div className="bg-surface-secondary px-margin-tight py-margin-tight type-body-em text-text-primary">
                  Address
                </div>
              )}
              <ScrollArea stableGutter={false} className="max-h-80">
                <DataTable aria-label="Peers">
                  <TableBody>
                    {peerItems.length > 0 ? (
                      peerItems.map((peer) => (
                        <TableRow key={peer}>
                          {visibility.address && (
                            <TableCell className="min-w-0">
                              <code className="text-text-primary truncate">{peer}</code>
                            </TableCell>
                          )}
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
          )}
        </div>
      </div>
    </SubSection>
  );
}
