export class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (data as { error?: { message?: string } })?.error?.message ??
        `Request failed with status ${res.status}`;
      throw new Error(message);
    }

    return { status: res.status, data };
  }

  async get(path: string) {
    return this.request("GET", path);
  }

  async post(path: string, body?: unknown) {
    return this.request("POST", path, body);
  }

  async patch(path: string, body?: unknown) {
    return this.request("PATCH", path, body);
  }
}
