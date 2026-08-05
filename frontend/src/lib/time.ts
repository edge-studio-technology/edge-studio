export function formatLocalTime(value: Date | string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Compact local date+time for table cells and detail fields (e.g. "5 Aug 2026, 15:23"). */
export function formatLocalDateTime(value: Date | string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatUtcTime(value: Date | string) {
  const date = new Date(value);
  return `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}:${date.getUTCSeconds().toString().padStart(2, "0")}Z`;
}
