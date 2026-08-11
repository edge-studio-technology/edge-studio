import { useEffect, useState } from "react";
import { formatLocalTime } from "../lib/time";
import { Pill } from "./Pill";

function formatUtcClock(value: Date) {
  return [
    value.getUTCHours().toString().padStart(2, "0"),
    value.getUTCMinutes().toString().padStart(2, "0"),
    value.getUTCSeconds().toString().padStart(2, "0"),
  ].join(":");
}

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="gap-detail-tight flex shrink-0 items-center" aria-label="Current local and UTC time">
      <Pill>Local {formatLocalTime(now)}</Pill>
      <Pill>UTC {formatUtcClock(now)}</Pill>
    </div>
  );
}
