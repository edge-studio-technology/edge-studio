import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAuditReport, picomatchException } from "../../dev/check-audit.mjs";

const now = Date.parse("2026-11-18T12:00:00Z");
const advisory = {
  name: "picomatch", dependency: "picomatch", url: picomatchException.advisory, severity: "high"
};

type Finding = { name: string; severity: string; nodes: string[]; via: Array<string | typeof advisory> };

function fixture() {
  const lock: { lockfileVersion: number; packages: Record<string, { name?: string; version?: string; dev?: boolean }> } = { lockfileVersion: 3, packages: {
    "": { name: "example" },
    "node_modules/picomatch": { version: "4.0.7", dev: true },
    "node_modules/vitest": { version: "4.1.12", dev: true },
    "node_modules/@vitest/coverage-v8": { version: "4.1.12", dev: true }
  } };
  const report: { auditReportVersion: number; vulnerabilities: Record<string, Finding> } = { auditReportVersion: 2, vulnerabilities: {
    picomatch: { name: "picomatch", severity: "high", nodes: ["node_modules/picomatch"], via: [advisory] },
    vitest: { name: "vitest", severity: "high", nodes: ["node_modules/vitest"], via: ["picomatch", "@vitest/coverage-v8"] },
    "@vitest/coverage-v8": { name: "@vitest/coverage-v8", severity: "high", nodes: ["node_modules/@vitest/coverage-v8"], via: ["vitest"] }
  } };
  return { lock, report };
}

describe("temporary development audit exception", () => {
  it("accepts only the approved advisory and exclusively derived development findings, including cycles", () => {
    const { report, lock } = fixture();
    expect(checkAuditReport(report, lock, { now })).toEqual(["picomatch", "vitest", "@vitest/coverage-v8"]);
  });

  it("passes a clean production report without applying the exception", () => {
    expect(checkAuditReport({ auditReportVersion: 2, vulnerabilities: {} }, fixture().lock, { production: true, now })).toEqual([]);
  });

  it("never exempts findings from a production audit", () => {
    const { report, lock } = fixture();
    expect(() => checkAuditReport(report, lock, { production: true, now })).toThrow("Blocking");
  });

  it.each([false, undefined])("rejects production-reachable picomatch even in a clean report (dev=%s)", (dev) => {
    const { lock } = fixture();
    lock.packages["node_modules/picomatch"].dev = dev;
    expect(() => checkAuditReport({ auditReportVersion: 2, vulnerabilities: {} }, lock, { now })).toThrow("production dependency");
  });

  it("rejects a production-reachable parent of an accepted advisory", () => {
    const { report, lock } = fixture();
    lock.packages["node_modules/vitest"].dev = false;
    expect(() => checkAuditReport(report, lock, { now })).toThrow("Blocking");
  });

  it.each(["2026-12-02T00:00:00Z", "2026-12-03T00:00:00Z"])("fails at or after expiry %s", (date) => {
    const { report, lock } = fixture();
    expect(() => checkAuditReport(report, lock, { now: Date.parse(date) })).toThrow("expired");
  });

  it("requires removal or review when the installed picomatch version changes", () => {
    const { report, lock } = fixture();
    lock.packages["node_modules/picomatch"].version = "4.0.8";
    expect(() => checkAuditReport(report, lock, { now })).toThrow("version changed");
  });

  it.each(["moderate", "high", "critical"])("blocks another %s advisory alongside the accepted one", (severity) => {
    const { report, lock } = fixture();
    report.vulnerabilities.picomatch.via.push({ ...advisory, url: "https://github.com/advisories/GHSA-other", severity });
    expect(() => checkAuditReport(report, lock, { now })).toThrow("Blocking");
  });

  it("blocks an unrelated package advisory even if it uses the accepted URL", () => {
    const { report, lock } = fixture();
    report.vulnerabilities.vitest.via = [{ ...advisory, name: "vitest", dependency: "vitest" }];
    expect(() => checkAuditReport(report, lock, { now })).toThrow("Blocking");
  });

  it("blocks a separate vulnerable package without hiding it behind accepted findings", () => {
    const { report, lock } = fixture();
    lock.packages["node_modules/other"] = { version: "1.0.0", dev: true };
    report.vulnerabilities.other = {
      name: "other", severity: "moderate", nodes: ["node_modules/other"],
      via: [{ ...advisory, name: "other", dependency: "other", url: "https://github.com/advisories/GHSA-other" }]
    };
    expect(() => checkAuditReport(report, lock, { now })).toThrow("Blocking npm audit findings: other");
  });

  it("retains the moderate threshold for unrelated low findings", () => {
    const { report, lock } = fixture();
    const low = { ...advisory, url: "https://github.com/advisories/GHSA-low", severity: "low" };
    const lowReport = { auditReportVersion: 2, vulnerabilities: {
      other: { name: "other", severity: "low", nodes: ["node_modules/other"], via: [low] }
    } };
    expect(checkAuditReport(lowReport, { ...lock, packages: { ...lock.packages, "node_modules/other": { version: "1.0.0", dev: true } } }, { now })).toEqual([]);
    expect(checkAuditReport(report, lock, { now })).toHaveLength(3);
  });

  it.each([{}, { error: { code: "ENOAUDIT" } }, { auditReportVersion: 3, vulnerabilities: {} }])("fails closed on invalid audit responses", (report) => {
    expect(() => checkAuditReport(report, fixture().lock, { now })).toThrow("Invalid npm audit response");
  });

  it("rejects missing lock nodes, unresolved dependencies and advisory-free cycles", () => {
    for (const failure of ["node", "dependency", "cycle"]) {
      const { report, lock } = fixture();
      if (failure === "node") report.vulnerabilities.picomatch.nodes = ["node_modules/missing"];
      if (failure === "dependency") report.vulnerabilities.vitest.via = ["missing"];
      if (failure === "cycle") report.vulnerabilities.picomatch.via = ["vitest"];
      expect(() => checkAuditReport(report, lock, { now })).toThrow();
    }
  });

  it.each([
    'process.exit(2);',
    'console.log("not JSON");',
    'console.log(JSON.stringify({ error: { code: "ENOAUDIT" } })); process.exit(1);'
  ])("fails the CLI when the audit command errors or returns invalid data", (source) => {
    const folder = mkdtempSync(join(tmpdir(), "edge-audit-test-"));
    try {
      const npm = join(folder, "npm-fixture.cjs");
      writeFileSync(npm, source);
      const result = spawnSync(process.execPath, [fileURLToPath(new URL("../../dev/check-audit.mjs", import.meta.url))], {
        encoding: "utf8", env: { ...process.env, npm_execpath: npm }
      });
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain("audit: passed");
      expect(result.stderr).not.toBe("");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
