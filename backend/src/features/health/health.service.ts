export function getHealthStatus() {
  return { status: "ok" as const, service: "edge-studio-backend" as const };
}
