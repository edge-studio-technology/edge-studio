import { env } from "../../config/env.js";
import { initializeLocalAddressBookEntry } from "../address-book/address-book.service.js";
import {
  canAutoResync,
  detectStall,
  recordAutoResync,
  recordPollerCheck,
  recordStallDetected
} from "./minima-monitoring.js";
import { getMinimaNodeStatus, resyncMegammr } from "./minima.service.js";
import { MinimaResyncConflictError } from "./minima.errors.js";

let poller: NodeJS.Timeout | null = null;
let pollRunning = false;

export async function pollMinimaHealth() {
  if (pollRunning) return;

  pollRunning = true;
  try {
    const status = await getMinimaNodeStatus();
    recordPollerCheck(status.checkedAt, status.state);

    if (status.state === "running") {
      try {
        await initializeLocalAddressBookEntry();
      } catch {
        console.error("Minima health poller: local address-book initialization failed");
      }
    }

    if (!detectStall(status)) return;

    recordStallDetected();
    const blockAge = status.sync.blockAgeSeconds ?? "unknown";
    console.warn(`Minima health poller: chain stall detected (block age ${blockAge}s, threshold ${env.minimaStallBlockAgeSeconds}s)`);

    if (!env.minimaAutoResync) return;
    if (!canAutoResync()) {
      console.warn("Minima health poller: auto-resync skipped (cooldown active)");
      return;
    }

    try {
      const result = await resyncMegammr("auto");
      recordAutoResync(result.message);
      console.log("Minima health poller: auto-resync starting");
    } catch (error) {
      if (error instanceof MinimaResyncConflictError) return;
      const message = error instanceof Error ? error.message : "resync failed";
      recordAutoResync(message);
      console.error(`Minima health poller: auto-resync failed (${message})`);
    }
  } catch (error) {
    console.error("Minima health poller failed:", error instanceof Error ? error.message : error);
  } finally {
    pollRunning = false;
  }
}

export function startMinimaHealthPoller() {
  if (poller) return;

  const intervalMs = env.minimaHealthPollIntervalSeconds * 1000;
  const runPoll = () => {
    pollMinimaHealth().catch((error) => {
      console.error("Minima health poller failed:", error instanceof Error ? error.message : error);
    });
  };

  runPoll();
  poller = setInterval(runPoll, intervalMs);
}

export function stopMinimaHealthPoller() {
  if (poller) {
    clearInterval(poller);
    poller = null;
  }
}
