import { Activity, Cable, Inbox, Play, Plus } from "lucide-react";
import { useState } from "react";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableIconButton,
  TableIconMenu,
  TableRow,
  TableWrap,
} from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { JsonPreviewContent } from "../../components/JsonPreview";
import { CopyableCode } from "../../components/patterns/CopyableCode";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorDetailPanel } from "../../components/patterns/ErrorDetailPanel";
import { ListFilterBar } from "../../components/patterns/ListFilterBar";
import { ListPaginationFooter } from "../../components/patterns/ListPaginationFooter";
import { LoadingState } from "../../components/patterns/LoadingState";
import { Button } from "../../components/ui/Button";
import { Disclosure } from "../../components/ui/Disclosure";
import { Pill } from "../../components/ui/Pill";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatLocalDateTime } from "../../lib/time";
import type { DataSource, DataSourceHealthStatus } from "./dataSourceTypes";
import { hasDeviceSetupGuide } from "./deviceSetupGuides";
import { HealthErrorPanel } from "./HealthErrorPanel";

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

const DIRECTION_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "Input", label: "Input" },
  { value: "Output", label: "Output" },
  { value: "Capture", label: "Capture" },
] as const;

export function DataSourcesList({
  items,
  healthStatuses,
  busy,
  loading = false,
  onRead,
  onTestOutput,
  onOpenSetupGuide,
  onEdit,
  onDelete,
  onAddInput,
  onAddOutput,
}: {
  items: DataSource[];
  healthStatuses: Record<string, DataSourceHealthStatus>;
  busy: boolean;
  loading?: boolean;
  onRead: (source: DataSource) => void;
  onTestOutput: (source: DataSource) => void;
  onOpenSetupGuide: (source: DataSource) => void;
  onEdit: (source: DataSource) => void;
  onDelete: (source: DataSource) => void;
  onAddInput?: () => void;
  onAddOutput?: () => void;
}) {
  const [detailsSource, setDetailsSource] = useState<DataSource | null>(null);
  const [direction, setDirection] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);

  const trimmedQuery = query.trim().toLowerCase();
  const filtersActive = Boolean(direction || trimmedQuery);
  const visibleItems = items.filter((source) => {
    if (direction && sourceDirection(source) !== direction) return false;
    if (!trimmedQuery) return true;
    return (
      source.name.toLowerCase().includes(trimmedQuery) ||
      sourceTypeLabel(source).toLowerCase().includes(trimmedQuery) ||
      (sourceEndpoint(source) ?? "").toLowerCase().includes(trimmedQuery)
    );
  });
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = visibleItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearFilters() {
    setDirection("");
    setQuery("");
    setPage(1);
  }

  return (
    <TableCard
      className="w-full"
      title="Configured devices"
      description="Create and monitor your configured input sources and output targets."
    >
      <div className="gap-detail-close flex flex-wrap items-end justify-between">
        <div className="min-w-0 flex-1 [&>div]:mb-0">
          <ListFilterBar
            filter={direction}
            q={query}
            filterOptions={DIRECTION_FILTER_OPTIONS}
            searchPlaceholder="Name, type, or endpoint"
            disabled={loading || items.length === 0}
            onFilterChange={(value) => {
              setDirection(value);
              setPage(1);
            }}
            onQueryChange={(q) => {
              setQuery(q);
              setPage(1);
            }}
          />
        </div>
        {onAddInput || onAddOutput ? (
          <div className="gap-detail-next flex flex-wrap items-center">
            {onAddInput ? (
              <Button type="button" iconStart={<Plus aria-hidden />} onClick={onAddInput}>
                New input
              </Button>
            ) : null}
            {onAddOutput ? (
              <Button
                type="button"
                variant="secondary"
                iconStart={<Plus aria-hidden />}
                onClick={onAddOutput}
              >
                New output
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <LoadingState title="Fetching your devices" description="This should take a few seconds." />
      ) : visibleItems.length === 0 ? (
        <EmptyContentState
          icon={filtersActive ? Inbox : Cable}
          title={filtersActive ? "No matching devices" : "Connect your first device"}
          description={
            filtersActive
              ? "Try another direction or search, or clear filters."
              : "Your input sources and output targets will be added to your library here."
          }
          actionLabel={filtersActive ? "Clear filters" : onAddInput ? "New input" : undefined}
          actionIcon={filtersActive ? undefined : onAddInput ? <Plus aria-hidden /> : undefined}
          actionVariant={filtersActive ? "secondary" : "primary"}
          onAction={filtersActive ? clearFilters : onAddInput}
          secondaryActionLabel={!filtersActive && onAddOutput ? "New output" : undefined}
          secondaryActionIcon={!filtersActive && onAddOutput ? <Plus aria-hidden /> : undefined}
          onSecondaryAction={!filtersActive ? onAddOutput : undefined}
        />
      ) : (
        <TableWrap>
          <DataTable className="table-fixed">
            <TableHead>
              <TableHeaderCell className="w-52">Name</TableHeaderCell>
              <TableHeaderCell className="w-28">Direction</TableHeaderCell>
              <TableHeaderCell className="w-56">Type</TableHeaderCell>
              <TableHeaderCell className="w-72">Endpoint</TableHeaderCell>
              <TableHeaderCell className="w-40">Health</TableHeaderCell>
              <TableHeaderCell className="w-40">Last hash</TableHeaderCell>
              <TableHeaderCell className="w-36">Last preview</TableHeaderCell>
              <TableHeaderCell className="w-28">Actions</TableHeaderCell>
            </TableHead>
            <TableBody>
              {pagedItems.map((source) => {
                const usedByWorkflows = source.usedByWorkflows ?? [];
                const deleteDisabledReason =
                  usedByWorkflows.length > 0
                    ? `Used by workflow: ${usedByWorkflows.map((workflow) => workflow.name).join(", ")}`
                    : "Delete device";
                const typeLabel = sourceTypeLabel(source);
                const endpoint = sourceEndpoint(source);
                return (
                  <TableRow key={source.id}>
                    <TableCell className="min-w-0">
                      <span className="type-body-em block truncate" title={source.name}>
                        {source.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-text-secondary">{sourceDirection(source)}</TableCell>
                    <TableCell className="min-w-0">
                      <span className="text-text-secondary block truncate" title={typeLabel}>
                        {typeLabel}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <code className="type-mono block truncate" title={endpoint}>
                        {endpoint}
                      </code>
                    </TableCell>
                    <TableCell>
                      <HealthCell source={source} status={healthStatuses[source.id]} />
                    </TableCell>
                    <TableCell>
                      {source.lastHash ? (
                        <TruncatedHash value={source.lastHash} />
                      ) : (
                        <span className="text-text-secondary">Not read yet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <LastPreviewCell source={source} />
                    </TableCell>
                    <TableCell>
                      <RowActions>
                        <TableIconButton
                          type="button"
                          disabled={
                            busy ||
                            source.type === "webhook" ||
                            source.type === "mqtt" ||
                            source.type === "gpio-input" ||
                            source.type === "gpio-output" ||
                            source.type === "pi-camera" ||
                            source.type === "http-output" ||
                            source.type === "mqtt-output"
                          }
                          title="Trigger manually"
                          aria-label={`Trigger ${source.name} manually`}
                          onClick={() => onRead(source)}
                        >
                          <Play size={16} aria-hidden />
                        </TableIconButton>
                        <TableIconMenu
                          aria-label={`More actions for ${source.name}`}
                          items={[
                            ...(source.type === "gpio-output" ||
                            source.type === "http-output" ||
                            source.type === "mqtt-output"
                              ? [
                                  {
                                    label:
                                      source.type === "gpio-output" ? "Test pulse" : "Test output",
                                    disabled: busy,
                                    onClick: () => onTestOutput(source),
                                  },
                                ]
                              : []),
                            ...(hasDeviceSetupGuide(source)
                              ? [
                                  {
                                    label: "Setup guide",
                                    disabled: busy,
                                    onClick: () => onOpenSetupGuide(source),
                                  },
                                ]
                              : []),
                            {
                              label: "View details",
                              disabled: busy,
                              onClick: () => setDetailsSource(source),
                            },
                            {
                              label: "Edit",
                              disabled: busy,
                              onClick: () => onEdit(source),
                            },
                            {
                              label: "Delete",
                              title: deleteDisabledReason,
                              danger: true,
                              disabled: busy || usedByWorkflows.length > 0,
                              onClick: () => onDelete(source),
                            },
                          ]}
                        />
                      </RowActions>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </TableWrap>
      )}

      <ListPaginationFooter
        page={currentPage}
        pageSize={pageSize}
        total={visibleItems.length}
        totalPages={totalPages}
        disabled={loading}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {detailsSource && (
        <DeviceDetailsModal
          source={detailsSource}
          status={healthStatuses[detailsSource.id]}
          onClose={() => setDetailsSource(null)}
        />
      )}
    </TableCard>
  );
}

function webhookUrl(source: DataSource) {
  return source.config.webhookToken
    ? `${window.location.origin}/api/data-source-webhooks/${source.config.webhookToken}`
    : "Generated after save";
}

function mqttEndpoint(source: DataSource) {
  return `${source.config.brokerUrl ?? "mqtt://"} ${source.config.topic ?? ""}`;
}

function gpioEndpoint(source: DataSource) {
  return `${source.config.profile === "pir-motion" ? "PIR motion " : ""}${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"} ${source.config.edge ?? "both"}`;
}

function sourceTypeLabel(source: DataSource) {
  if (source.type === "gpio-input" && source.config.profile === "pir-motion")
    return "PIR Motion Sensor";
  if (source.type === "mqtt" && source.config.profile === "esp32-mqtt-board")
    return "ESP32 MQTT Board";
  if (source.type === "json-api") return "HTTP JSON Source";
  if (source.type === "webhook") return "Webhook Receiver";
  if (source.type === "mqtt") return "MQTT Subscriber";
  if (source.type === "gpio-input") return "GPIO Input Pin";
  if (source.type === "gpio-output") return "GPIO LED";
  if (source.type === "pi-camera") return "Raspberry Pi Camera";
  if (source.type === "bme-sensor")
    return source.config.sensor === "bme680"
      ? "BME680 Environmental Sensor"
      : "BME280 Environmental Sensor";
  if (source.type === "http-output") return "HTTP JSON Target";
  if (source.type === "mqtt-output") return "MQTT Publisher";
  return source.type;
}

function gpioOutputEndpoint(source: DataSource) {
  return `${source.config.profile ?? "led"} ${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"} active:${source.config.activeState ?? "high"}`;
}

function cameraEndpoint(source: DataSource) {
  return `${source.config.mode ?? "photo"} ${source.config.width ?? 1280}x${source.config.height ?? 720}${source.config.mode === "video" ? ` ${source.config.durationMs ?? 5000}ms @ ${source.config.fps ?? 30}fps` : ""}`;
}

function bmeEndpoint(source: DataSource) {
  return `${source.config.sensor ?? "bme280"} i2c-${source.config.bus ?? 1} ${source.config.address ?? "0x76"}`;
}

function isInputSource(source: DataSource) {
  return (
    source.type === "json-api" ||
    source.type === "webhook" ||
    source.type === "mqtt" ||
    source.type === "gpio-input" ||
    source.type === "pi-camera" ||
    source.type === "bme-sensor"
  );
}

function sourceDirection(source: DataSource) {
  return source.type === "pi-camera" ? "Capture" : isInputSource(source) ? "Input" : "Output";
}

function sourceEndpoint(source: DataSource) {
  if (source.type === "webhook") return webhookUrl(source);
  if (source.type === "mqtt" || source.type === "mqtt-output") return mqttEndpoint(source);
  if (source.type === "gpio-input") return gpioEndpoint(source);
  if (source.type === "gpio-output") return gpioOutputEndpoint(source);
  if (source.type === "pi-camera") return cameraEndpoint(source);
  if (source.type === "bme-sensor") return bmeEndpoint(source);
  return source.config.url;
}

function supportsHealthCheck(source: DataSource) {
  return (
    source.type !== "bme-sensor" &&
    source.type !== "webhook" &&
    source.type !== "mqtt" &&
    source.type !== "gpio-input" &&
    source.type !== "gpio-output" &&
    source.type !== "pi-camera" &&
    source.type !== "http-output" &&
    source.type !== "mqtt-output" &&
    Boolean(source.config.healthStatusUrl)
  );
}

function HealthCell({ source, status }: { source: DataSource; status?: DataSourceHealthStatus }) {
  if (!supportsHealthCheck(source) || !status)
    return (
      <Pill tone="neutral" indicator>
        Not configured
      </Pill>
    );

  return (
    <Pill tone={status.ok ? "good" : "error"} indicator>
      {status.ok ? "Success" : "Failed"}
    </Pill>
  );
}

function LastPreviewCell({ source }: { source: DataSource }) {
  if (source.lastPreview)
    return (
      <Pill tone="good" indicator>
        Success
      </Pill>
    );
  if (source.lastError)
    return (
      <Pill tone="error" indicator>
        Failed
      </Pill>
    );
  return (
    <Pill tone="neutral" indicator>
      No preview
    </Pill>
  );
}

function DeviceDetailsModal({
  source,
  status,
  onClose,
}: {
  source: DataSource;
  status?: DataSourceHealthStatus;
  onClose: () => void;
}) {
  return (
    <Modal title="Device details" onClose={onClose}>
      <div className="gap-detail-near grid">
        <DetailList>
          <DetailRow label="Name" value={source.name} />
          <DetailRow label="Description" value={source.description || "—"} />
          <DetailRow label="Direction" value={sourceDirection(source)} />
          <DetailRow label="Type" value={sourceTypeLabel(source)} />
          <DetailRow label="Endpoint" value={sourceEndpoint(source)} mono />
          <DetailRow
            label="Last hash"
            value={
              source.lastHash ? (
                <CopyableCode value={source.lastHash} />
              ) : (
                <span className="text-text-secondary">Not read yet</span>
              )
            }
          />
        </DetailList>

        <div className="flex flex-col gap-4 pb-2 pl-2">
          <Disclosure
            title={
              <span className="flex items-center gap-2">
                Health
                <HealthCell source={source} status={status} />
              </span>
            }
          >
            {status && !status.ok ? (
              <HealthErrorPanel status={status} />
            ) : (
              <div className="gap-detail-near grid">
                {status?.checkedAt && (
                  <DetailList>
                    <DetailRow label="Checked at" value={formatLocalDateTime(status.checkedAt)} />
                  </DetailList>
                )}
                {status?.body !== undefined ? (
                  <JsonPreviewContent value={status.body} />
                ) : (
                  <EmptyContentState
                    icon={Activity}
                    title="No health data"
                    description="Add a health status URL to this device to monitor its availability here."
                  />
                )}
              </div>
            )}
          </Disclosure>
          <Disclosure
            title={
              <span className="flex items-center gap-2">
                Last preview
                <LastPreviewCell source={source} />
              </span>
            }
          >
            {source.lastPreview ? (
              <div className="gap-detail-near grid">
                {source.lastReadAt && (
                  <DetailList>
                    <DetailRow label="Checked at" value={formatLocalDateTime(source.lastReadAt)} />
                  </DetailList>
                )}
                <JsonPreviewContent value={source.lastPreview} />
              </div>
            ) : source.lastError ? (
              <ErrorDetailPanel
                error={source.lastErrorDetails ?? source.lastError}
                extraRows={
                  source.lastReadAt ? (
                    <DetailRow label="Checked at" value={formatLocalDateTime(source.lastReadAt)} />
                  ) : undefined
                }
              />
            ) : (
              <EmptyContentState
                icon={Inbox}
                title="No preview"
                description="Trigger a manual read, or wait for the next scheduled run, to see a preview here."
              />
            )}
          </Disclosure>
        </div>
      </div>
    </Modal>
  );
}
