import { type DemoDraft, type DemoModule } from "./demoData";

export function validateDemoDraft(draft: DemoDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Give the module a name.");
  for (const filename of ["module.json", "schemas/config.json"]) {
    try {
      const parsed: unknown = JSON.parse(draft.files[filename] ?? "");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Expected a JSON object");
      if (filename === "module.json") {
        const manifest = parsed as Record<string, unknown>;
        if (typeof manifest.id !== "string" || typeof manifest.version !== "string")
          errors.push("The manifest needs an ID and version.");
        if (
          typeof manifest.entry !== "string" ||
          !Object.prototype.hasOwnProperty.call(draft.files, manifest.entry)
        )
          errors.push("The manifest entry must point to an included source file.");
      }
    } catch {
      errors.push(`${filename} must contain a JSON object.`);
    }
  }
  return errors;
}

export function demoDraftRevision(draft: DemoDraft) {
  return JSON.stringify([draft.name, draft.description, draft.files]);
}

export function downloadDemoFile(filename: string, value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseDemoDraft(text: string): DemoDraft {
  const parsed = JSON.parse(text);
  const draft = parsed?.draft;
  if (
    parsed?.demo !== true ||
    !draft ||
    typeof draft.id !== "string" ||
    !/^[a-z0-9][a-z0-9._-]*$/i.test(draft.id) ||
    typeof draft.name !== "string" ||
    typeof draft.description !== "string" ||
    ![
      "camera",
      "radio",
      "thermometer",
      "globe",
      "workflow",
      "shield",
      "sprout",
      "bell",
      "cpu",
    ].includes(draft.icon) ||
    !["purple", "green", "blue", "orange"].includes(draft.color) ||
    !draft.files ||
    typeof draft.files !== "object" ||
    Array.isArray(draft.files) ||
    !Object.values(draft.files).every((value) => typeof value === "string")
  )
    throw new Error(
      "Choose a source or package snapshot exported by this demo. Code is never executed.",
    );
  return { ...draft, files: { ...draft.files }, saved: true };
}

export function demoReleaseFiles(module: DemoModule): Record<string, string> {
  return (
    module.releaseFiles ?? {
      "module.json": JSON.stringify(
        {
          id: module.id,
          name: module.name,
          version: module.version,
          entry: "src/index.ts",
          compatibility: { edgeStudio: "Sample app compatibility" },
          access: { host: module.hostAccess },
          dependencies: {},
          license: "Illustrative; policy undecided",
        },
        null,
        2,
      ),
      "src/index.ts": `// Illustrative release fixture for ${module.id} v${module.version}.\n// This is not the actual device implementation and is never executed.\nexport const contribution = ${JSON.stringify({ name: module.name, contributions: module.contributions }, null, 2)};\n`,
      "README.md": `# ${module.name}\n\nSample release ${module.version}.\n\n${module.description}\n`,
    }
  );
}
