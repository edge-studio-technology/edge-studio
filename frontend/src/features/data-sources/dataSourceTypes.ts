export type DataSource = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  type: "json-api" | "webhook" | "mqtt" | "gpio-input" | "gpio-output" | "pi-camera" | "bme-sensor" | "device-system-data" | "http-output" | "mqtt-output";
  status: string;
  description: string | null;
  config: {
    url?: string;
    method?: "GET" | "POST" | "PUT" | "PATCH";
    headers?: Record<string, string>;
    healthStatusUrl?: string;
    webhookToken?: string;
    brokerUrl?: string;
    topic?: string;
    chip?: string;
    pin?: number;
    pull?: "off" | "up" | "down";
    edge?: "rising" | "falling" | "both";
    debounceMs?: number;
    activeState?: "high" | "low";
    profile?: "led" | "pir-motion" | "generic" | "esp32-mqtt-board";
    initialState?: "inactive";
    body?: unknown;
    timeoutMs?: number;
    qos?: 0 | 1;
    retain?: boolean;
    mode?: "photo" | "video";
    width?: number;
    height?: number;
    durationMs?: number;
    fps?: number;
    outputFormat?: "jpg" | "h264";
    sensor?: "bme280" | "bme680";
    bus?: number;
    address?: "0x76" | "0x77";
    includeSpecs?: boolean;
    includePerformance?: boolean;
    includeNetwork?: boolean;
    includeLocation?: boolean;
  };
  lastReadAt: string | null;
  lastError: string | null;
  lastErrorDetails?: unknown;
  lastPreview: unknown;
  lastHash: string | null;
  usedByWorkflows?: { id: string; name: string }[];
};

export type DataSourceTemplate = {
  title: string;
  description: string;
  type: DataSource["type"];
  config: Partial<DataSource["config"]>;
};

export type DataSourceHealthStatus = {
  ok: boolean;
  status?: number;
  source?: string;
  body?: unknown;
  checkedAt?: string;
  error?: string;
  errorDetails?: unknown;
};

export type DataSourceCapabilities = {
  gpioInput: {
    available: boolean;
    devicePath: string;
    reason: string | null;
  };
  mqttBroker?: {
    enabled: boolean;
    internalUrl: string;
    publicHost: string;
    publicPort: number;
  };
  camera?: {
    available: boolean;
    enabled: boolean;
    captureDir: string;
    reason: string | null;
    photoCommand?: string;
    videoCommand?: string;
    cameras?: string;
  };
  sensors?: {
    enabled: boolean;
    available: boolean;
    reason: string | null;
    supportedSensors?: string[];
  };
};

export type HostCapability = {
  name: "camera";
  enabled: boolean;
  installed: boolean;
  available: boolean;
  state: "disabled" | "applying" | "enabled" | "failed" | "needs_reboot" | "missing_prerequisites";
  reason: string | null;
  captureDir?: string;
  helperPort?: number;
};
