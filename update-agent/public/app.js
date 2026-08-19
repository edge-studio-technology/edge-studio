const views = {
  updating: document.getElementById("view-updating"),
  success: document.getElementById("view-success"),
  failure: document.getElementById("view-failure"),
  idle: document.getElementById("view-idle")
};

function showView(name) {
  for (const key of Object.keys(views)) {
    views[key].classList.toggle("hidden", key !== name);
  }
}

const POLL_INTERVAL_MS = 3000;
// A successful frontend update restarts the very container proxying this
// page, so polls during that window fail even though the update is fine.
// Only give up after this many *consecutive* poll failures.
const MAX_CONSECUTIVE_POLL_FAILURES = 10;

function finishWithFailure(message) {
  document.getElementById("failure-message").textContent = message;
  showView("failure");
  setTimeout(() => window.location.assign("/"), 4000);
}

function finishWithSuccess() {
  showView("success");
  setTimeout(() => window.location.assign("/"), 4000);
}

// This page only ever polls — it never starts a job itself. See
// docs/adr/0002-update-page-split.md.
async function pollApplyStatus(consecutiveFailures = 0) {
  let data;
  try {
    const response = await fetch("/update/apply", { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Status check failed (HTTP ${response.status})`);
    }
    data = await response.json();
  } catch {
    if (consecutiveFailures + 1 >= MAX_CONSECUTIVE_POLL_FAILURES) {
      finishWithFailure("Lost contact with the update agent. If the frontend was updated, reload to check its status.");
      return;
    }
    setTimeout(() => pollApplyStatus(consecutiveFailures + 1), POLL_INTERVAL_MS);
    return;
  }

  if (data.state === "idle") {
    showView("idle");
    return;
  }

  if (data.state === "running") {
    showView("updating");
    setTimeout(() => pollApplyStatus(0), POLL_INTERVAL_MS);
    return;
  }

  if (data.state === "failed") {
    finishWithFailure(data.error || "Update failed");
    return;
  }

  if (data.state !== "succeeded") {
    finishWithFailure(`Unexpected update status: ${data.state}`);
    return;
  }

  const failed = data.results.filter((result) => !result.updated && result.reason !== "already up to date");
  if (failed.length > 0) {
    finishWithFailure(failed.map((result) => `${result.service}: ${result.reason}`).join(" "));
  } else {
    finishWithSuccess();
  }
}

pollApplyStatus();
