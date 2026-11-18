import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const picomatchException = {
  advisory: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
  version: "4.0.7",
  expires: "2026-12-02T00:00:00.000Z"
};

const severities = ["info", "low", "moderate", "high", "critical"];

export function checkAuditReport(report, lock, { production = false, now = Date.now() } = {}) {
  if (report?.error || report?.auditReportVersion !== 2 || !report.vulnerabilities ||
      typeof report.vulnerabilities !== "object" || Array.isArray(report.vulnerabilities)) {
    throw new Error("Invalid npm audit response; no findings were exempted");
  }
  if (lock?.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== "object") {
    throw new Error("Expected a v3 package lock with dependency metadata");
  }
  const picomatchNodes = Object.entries(lock.packages)
    .filter(([name]) => name.endsWith("node_modules/picomatch"));
  for (const [name, pkg] of picomatchNodes) {
    if (pkg.dev !== true) throw new Error(`picomatch is a production dependency: ${name}`);
    if (pkg.version !== picomatchException.version) {
      throw new Error("picomatch version changed; remove or review the audit exception");
    }
  }
  if (!Number.isFinite(now) || (picomatchNodes.length && now >= Date.parse(picomatchException.expires))) {
    throw new Error("picomatch audit exception expired; remove it or explicitly review the risk");
  }

  const findings = report.vulnerabilities;
  for (const [name, finding] of Object.entries(findings)) {
    if (finding?.name !== name || !severities.includes(finding.severity) ||
        !Array.isArray(finding.via) || !finding.via.length ||
        !Array.isArray(finding.nodes) || !finding.nodes.length ||
        finding.nodes.some((node) => typeof node !== "string" || !lock.packages[node])) {
      throw new Error(`Invalid npm audit finding: ${name}`);
    }
  }

  function trace(name, seen = new Set()) {
    if (seen.has(name)) return { developmentOnly: true, advisories: [] };
    const finding = findings[name];
    if (!finding) throw new Error(`Unresolved npm audit dependency: ${name}`);
    const nextSeen = new Set([...seen, name]);
    let developmentOnly = finding.nodes.every((node) => lock.packages[node]?.dev === true);
    const advisories = [];
    for (const via of finding.via) {
      if (typeof via === "string") {
        const child = trace(via, nextSeen);
        developmentOnly &&= child.developmentOnly;
        advisories.push(...child.advisories);
      } else if (via && typeof via === "object" && typeof via.url === "string") {
        advisories.push({ ...via, package: name });
      } else {
        throw new Error(`Invalid npm audit advisory: ${name}`);
      }
    }
    return { developmentOnly, advisories };
  }

  const accepted = [];
  const blocked = [];
  for (const [name, finding] of Object.entries(findings)) {
    const evidence = trace(name);
    if (!evidence.advisories.length) throw new Error(`No advisory evidence for ${name}`);
    if (severities.indexOf(finding.severity) < severities.indexOf("moderate")) continue;
    const exempt = !production && picomatchNodes.length > 0 && evidence.developmentOnly &&
      now < Date.parse(picomatchException.expires) && evidence.advisories.every((via) =>
        via.package === "picomatch" && via.name === "picomatch" &&
        via.dependency === "picomatch" && via.url === picomatchException.advisory);
    (exempt ? accepted : blocked).push(name);
  }
  if (blocked.length) throw new Error(`Blocking npm audit findings: ${blocked.join(", ")}`);
  return accepted;
}

function run() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  if (!process.env.npm_execpath) throw new Error("Run this check with npm run audit:moderate");
  for (const folder of ["backend", "frontend", "update-agent"]) {
    const lock = JSON.parse(readFileSync(new URL(`../../${folder}/package-lock.json`, import.meta.url), "utf8"));
    for (const production of [false, true]) {
      const args = [process.env.npm_execpath, "--prefix", folder, "audit", "--json", "--audit-level=moderate"];
      args.push(production ? "--omit=dev" : "--include=dev");
      const result = spawnSync(process.execPath, args, {
        cwd: root, encoding: "utf8", timeout: 90_000, maxBuffer: 10 * 1024 * 1024
      });
      if (result.error || result.signal || ![0, 1].includes(result.status)) {
        throw new Error(`${folder}: npm audit failed to complete; no findings were exempted`);
      }
      const report = JSON.parse(result.stdout);
      const accepted = checkAuditReport(report, lock, { production });
      console.log(`${folder} ${production ? "production" : "full"} audit: passed`);
      if (accepted.length) {
        console.warn(`Accepted ${picomatchException.advisory} for development-only findings: ${accepted.join(", ")}; expires ${picomatchException.expires}`);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
