import type { ApiKeyRepository, SessionRepository } from "../src/control-plane/repositories/interfaces.js";
import type {
  CreateFlyMachineRequest,
  FlyMachine,
  FlyMachinesClient
} from "../src/control-plane/adapters/fly-machines-client.js";
import type { ServiceApiKeyRecord, SessionRecord } from "../src/common/types.js";

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  public readonly records = new Map<string, ServiceApiKeyRecord>();

  public async create(record: ServiceApiKeyRecord): Promise<void> {
    this.records.set(record.keyId, record);
  }

  public async getById(keyId: string): Promise<ServiceApiKeyRecord | null> {
    return this.records.get(keyId) ?? null;
  }

  public async listByUser(userId: string): Promise<ServiceApiKeyRecord[]> {
    return [...this.records.values()].filter((record) => record.userId === userId);
  }

  public async revoke(keyId: string, revokedAt: string): Promise<void> {
    const record = this.records.get(keyId);
    if (record) {
      this.records.set(keyId, { ...record, revokedAt });
    }
  }
}

export class InMemorySessionRepository implements SessionRepository {
  public readonly records = new Map<string, SessionRecord>();

  public async create(record: SessionRecord): Promise<void> {
    this.records.set(record.sessionId, record);
  }

  public async getById(sessionId: string): Promise<SessionRecord | null> {
    return this.records.get(sessionId) ?? null;
  }

  public async listByUser(userId: string): Promise<SessionRecord[]> {
    return [...this.records.values()].filter((record) => record.userId === userId);
  }

  public async listAll(): Promise<SessionRecord[]> {
    return [...this.records.values()];
  }

  public async save(record: SessionRecord): Promise<void> {
    this.records.set(record.sessionId, record);
  }

  public async acquireTurnLock(sessionId: string): Promise<boolean> {
    const record = this.records.get(sessionId);
    if (!record || record.inFlightTurn) {
      return false;
    }
    this.records.set(sessionId, { ...record, inFlightTurn: true });
    return true;
  }

  public async releaseTurnLock(sessionId: string): Promise<void> {
    const record = this.records.get(sessionId);
    if (!record) {
      return;
    }
    this.records.set(sessionId, { ...record, inFlightTurn: false });
  }

  public async delete(sessionId: string): Promise<void> {
    this.records.delete(sessionId);
  }
}

type FakeMachineState = {
  heartbeat: unknown;
  messageResponse: Response;
};

export class FakeFlyMachinesClient implements FlyMachinesClient {
  public readonly createdMachines: Array<{ request: CreateFlyMachineRequest; machine: FlyMachine }> = [];
  public readonly destroyedMachineIds: string[] = [];
  public readonly machineState = new Map<string, FakeMachineState>();

  public async createMachine(input: CreateFlyMachineRequest): Promise<FlyMachine> {
    const machine = { id: `machine-${this.createdMachines.length + 1}` };
    this.createdMachines.push({ request: input, machine });
    this.machineState.set(machine.id, {
      heartbeat: {
        session_id: "pending",
        bootstrapped: false,
        has_conversation: false,
        busy: false,
        last_activity_at: new Date().toISOString()
      },
      messageResponse: new Response(
        JSON.stringify({
          session_id: "pending",
          status: "active",
          result: "ok",
          stop_reason: null,
          total_cost_usd: 0.01,
          num_turns: 1
        }),
        { status: 200 }
      )
    });
    return machine;
  }

  public async destroyMachine(_appName: string, machineId: string): Promise<void> {
    this.destroyedMachineIds.push(machineId);
    this.machineState.delete(machineId);
  }

  public async requestMachine(_baseUrl: string, machineId: string, path: string): Promise<Response> {
    const state = this.machineState.get(machineId);
    if (!state) {
      return new Response("missing", { status: 404 });
    }

    if (path === "/heartbeat") {
      return new Response(JSON.stringify(state.heartbeat), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (path === "/messages") {
      return state.messageResponse.clone();
    }

    return new Response("not found", { status: 404 });
  }
}
