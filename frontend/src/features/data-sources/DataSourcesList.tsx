import { Play } from "lucide-react";
import { useState } from "react";
import {
  DataTable,
  EmptyTableState,
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
import { ErrorDetailsContent } from "../../components/ErrorDetails";
import { MutedText } from "../../components/Text";
import { Pill } from "../../components/ui/Pill";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import type { DataSource, DataSourceHealthStatus } from "./dataSourceTypes";
import { hasDeviceSetupGuide } from "./deviceSetupGuides";

export function DataSourcesList({
  items,
  healthStatuses,
  busy,
  onRead,
  onTestOutput,
  onOpenSetupGuide,
  onEdit,
  onDelete,
}: {
  items: DataSource[];
  healthStatuses: Record<string, DataSourceHealthStatus>;
  busy: boolean;
  onRead: (source: DataSource) => void;
  onTestOutput: (source: DataSource) => void;
  onOpenSetupGuide: (source: DataSource) => void;
  onEdit: (source: DataSource) => void;
  onDelete: (source: DataSource) => void;
}) {
  const [detailsSource, setDetailsSource] = useState<DataSource | null>(null);

  return (
    <TableCard
      className="w-full"
      title="Configured devices"
      description="Input sources, capture devices, and output targets saved in SQLite."
    >
      <TableWrap>
        <DataTable className="min-w-[980px]">
          <TableHead>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Direction</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Endpoint</TableHeaderCell>
            <TableHeaderCell>Health</TableHeaderCell>
            <TableHeaderCell>Last hash</TableHeaderCell>
            <TableHeaderCell>Last preview</TableHeaderCell>
            <TableHeaderCell className="w-px whitespace-nowrap">Actions</TableHeaderCell>
          </TableHead>
          <TableBody>
            {items.map((source) => {
              const usedByWorkflows = source.usedByWorkflows ?? [];
              const deleteDisabledReason =
                usedByWorkflows.length > 0
                  ? `Used by workflow: ${usedByWorkflows.map((workflow) => workflow.name).join(", ")}`
                  : "Delete device";
              return (
                <TableRow key={source.id}>
                  <TableCell>
                    <strong>{source.name}</strong>
                  </TableCell>
                  <TableCell>
                    {source.type === "pi-camera"
                      ? "Capture"
                      : isInputSource(source)
                        ? "Input"
                        : "Output"}
                  </TableCell>
                  <TableCell>{sourceTypeLabel(source)}</TableCell>
                  <TableCell>
                    <code>
                      {source.type === "webhook"
                        ? webhookUrl(source)
                        : source.type === "mqtt" || source.type === "mqtt-output"
                          ? mqttEndpoint(source)
                          : source.type === "gpio-input"
                            ? gpioEndpoint(source)
                            : source.type === "gpio-output"
                              ? gpioOutputEndpoint(source)
                              : source.type === "pi-camera"
                                ? cameraEndpoint(source)
                                : source.type === "bme-sensor"
                                  ? bmeEndpoint(source)
                                  : source.config.url}
                    </code>
                  </TableCell>
                  <TableCell>
                    <HealthCell source={source} status={healthStatuses[source.id]} />
                  </TableCell>
                  <TableCell>
                    {source.lastHash ? (
                      <TruncatedHash value={source.lastHash} />
                    ) : (
                      <span className="text-slate-500">Not read yet</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {source.lastPreview ? (
                      <Pill tone="good" indicator>
                        Success
                      </Pill>
                    ) : source.lastError ? (
                      <Pill tone="error" indicator>
                        Failed
                      </Pill>
                    ) : (
                      <Pill tone="neutral" indicator>
                        No preview
                      </Pill>
                    )}
                  </TableCell>
                  <TableCell className="w-px whitespace-nowrap">
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
                        <Play size={16} />
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
      {items.length === 0 && <EmptyTableState>No devices added yet.</EmptyTableState>}
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
  if (source.type === "json-api" || source.type === "internal-json-api") return "HTTP JSON Source";
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
    source.type === "internal-json-api" ||
    source.type === "webhook" ||
    source.type === "mqtt" ||
    source.type === "gpio-input" ||
    source.type === "pi-camera" ||
    source.type === "bme-sensor"
  );
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
    <Modal title="Device details" description={source.description || undefined} onClose={onClose}>
      <div className="gap-detail-near grid">
        <section className="gap-detail-tight grid">
          <strong>Health</strong>
          {status?.body !== undefined ? (
            <JsonPreviewContent value={status.body} />
          ) : status?.error ? (
            <ErrorDetailsContent error={{ error: status.error }} />
          ) : (
            <MutedText className="m-0">No health data.</MutedText>
          )}
        </section>
        <section className="gap-detail-tight grid">
          <strong>Last preview</strong>
          {source.lastPreview ? (
            <JsonPreviewContent value={source.lastPreview} />
          ) : source.lastError ? (
            <ErrorDetailsContent error={source.lastErrorDetails ?? source.lastError} />
          ) : (
            <MutedText className="m-0">No preview.</MutedText>
          )}
        </section>
      </div>
    </Modal>
  );
}
