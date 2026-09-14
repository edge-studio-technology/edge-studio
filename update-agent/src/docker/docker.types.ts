export type DockerContainerSummary = {
  Id: string;
  Names: string[];
  State: string;
  Image: string;
  ImageID: string;
  Labels?: Record<string, string>;
};

export type DockerContainerInspect = {
  Id: string;
  Name: string;
  Image: string;
  State: { Running: boolean; Health?: { Status: string } };
  Config: {
    Env?: string[];
    Labels?: Record<string, string>;
    ExposedPorts?: Record<string, object>;
  };
  HostConfig: {
    Binds?: string[];
    GroupAdd?: string[];
    Devices?: Array<{ PathOnHost: string; PathInContainer: string; CgroupPermissions: string }>;
    RestartPolicy?: { Name: string; MaximumRetryCount?: number };
    ExtraHosts?: string[];
    PortBindings?: Record<string, { HostIp?: string; HostPort?: string }[]>;
  };
  NetworkSettings: {
    Networks: Record<string, { Aliases?: string[] | null }>;
  };
};

export type DockerImageSummary = {
  Id: string;
  RepoDigests?: string[];
  Created: number;
};
