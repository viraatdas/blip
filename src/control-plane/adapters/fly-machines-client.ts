import { HttpError } from "../../common/errors.js";

export type CreateFlyMachineRequest = {
  appName: string;
  image: string;
  env: Record<string, string>;
  internalPort: number;
  memoryMb: number;
  cpus: number;
};

export type FlyMachine = {
  id: string;
};

export interface FlyMachinesClient {
  createMachine(input: CreateFlyMachineRequest, apiToken: string): Promise<FlyMachine>;
  destroyMachine(appName: string, machineId: string, apiToken: string): Promise<void>;
  requestMachine(
    baseUrl: string,
    machineId: string,
    path: string,
    init?: RequestInit
  ): Promise<Response>;
}

export class HttpFlyMachinesClient implements FlyMachinesClient {
  public async createMachine(input: CreateFlyMachineRequest, apiToken: string): Promise<FlyMachine> {
    const response = await fetch(`https://api.machines.dev/v1/apps/${input.appName}/machines`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: {
          image: input.image,
          env: input.env,
          guest: {
            cpus: input.cpus,
            cpu_kind: "shared",
            memory_mb: input.memoryMb
          },
          restart: {
            policy: "no"
          },
          services: [
            {
              protocol: "tcp",
              internal_port: input.internalPort,
              ports: [
                { port: 80, handlers: ["http"] },
                { port: 443, handlers: ["tls", "http"] }
              ],
              autostart: false,
              autostop: "off"
            }
          ]
        }
      })
    });

    if (!response.ok) {
      throw new HttpError(
        502,
        "fly_machine_create_failed",
        `Fly machine creation failed with ${response.status}.`,
        await response.text()
      );
    }

    const body = (await response.json()) as { id: string };
    return { id: body.id };
  }

  public async destroyMachine(appName: string, machineId: string, apiToken: string): Promise<void> {
    const response = await fetch(`https://api.machines.dev/v1/apps/${appName}/machines/${machineId}?force=true`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    });

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      throw new HttpError(
        502,
        "fly_machine_delete_failed",
        `Fly machine deletion failed with ${response.status}.`,
        await response.text()
      );
    }
  }

  public async requestMachine(
    baseUrl: string,
    machineId: string,
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("fly-force-instance-id", machineId);

    return fetch(new URL(path, baseUrl), {
      ...init,
      headers
    });
  }
}
