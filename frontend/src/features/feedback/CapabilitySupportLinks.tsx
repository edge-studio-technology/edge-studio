const repositoryUrl = "https://github.com/edge-studio-technology/edge-studio";
const content = {
  device: {
    title: "Missing support for a device?",
    description: "Request hardware support or learn how to contribute an integration.",
    prompt: "Can't find your device?",
    requestLabel: "Request support",
    template: "device-support.yml",
    guide: "contributing-devices.md",
  },
  workflow: {
    title: "Missing a workflow capability?",
    description: "Request a new block or feature, or learn how to contribute workflow functionality.",
    prompt: "Missing a block?",
    requestLabel: "Request a feature",
    template: "workflow-request.yml",
    guide: "contributing-workflows.md",
  },
};

export function CapabilitySupportLinks({ kind, compact = false }: { kind: keyof typeof content; compact?: boolean }) {
  const item = content[kind];
  const requestLink = (
    <a className="text-text-primary underline underline-offset-2"
      href={`${repositoryUrl}/issues/new?template=${item.template}`}
      target="_blank" rel="noopener noreferrer">
      {item.requestLabel}
    </a>
  );

  if (compact) {
    return (
      <p className="type-meta text-text-secondary m-0">
        {item.prompt} {requestLink} <span>Public request on GitHub.</span>
      </p>
    );
  }

  return (
    <aside aria-label={item.title} className="border-stroke-secondary gap-detail-tight pt-detail-close grid border-t">
      <h3 className="type-body-em text-text-primary m-0">{item.title}</h3>
      <p className="type-body text-text-secondary m-0">{item.description}</p>
      <div className="type-body gap-detail-close flex flex-wrap items-center">
        {requestLink}
        <a className="text-text-primary underline underline-offset-2"
          href={`${repositoryUrl}/blob/main/docs/guides/${item.guide}`}
          target="_blank" rel="noopener noreferrer">
          Contribution guide
        </a>
        <span className="type-meta text-text-secondary">Requests are public on GitHub.</span>
      </div>
    </aside>
  );
}
