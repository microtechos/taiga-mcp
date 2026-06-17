export class TaigaClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private authToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    const url = process.env.TAIGA_URL;
    const username = process.env.TAIGA_USERNAME;
    const password = process.env.TAIGA_PASSWORD;

    if (!url || !username || !password) {
      throw new Error(
        "Missing required environment variables: TAIGA_URL, TAIGA_USERNAME, TAIGA_PASSWORD",
      );
    }

    this.baseUrl = url.replace(/\/+$/, "");
    if (!this.baseUrl.includes("/api/v1")) {
      this.baseUrl += "/api/v1";
    }
    this.username = username;
    this.password = password;
  }

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "normal",
        username: this.username,
        password: this.password,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Taiga auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    this.authToken = data.auth_token;
    this.refreshToken = data.refresh ?? null;
  }

  private async refreshAuth(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: this.refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      this.authToken = data.auth_token;
      this.refreshToken = data.refresh ?? this.refreshToken;
      return true;
    } catch {
      return false;
    }
  }

  private async ensureAuth(): Promise<void> {
    if (!this.authToken) {
      await this.login();
    }
  }

  private async headers(): Promise<Record<string, string>> {
    await this.ensureAuth();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            url.searchParams.set(key, value.join(","));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }
    return url.toString();
  }

  private async request(
    method: string,
    path: string,
    options?: {
      params?: Record<string, unknown>;
      body?: unknown;
      isMultipart?: boolean;
    },
  ): Promise<unknown> {
    const doRequest = async (): Promise<Response> => {
      const hdrs = await this.headers();

      const fetchOptions: RequestInit = { method, headers: hdrs };

      if (options?.body && !options?.isMultipart) {
        fetchOptions.body = JSON.stringify(options.body);
      } else if (options?.isMultipart && options.body instanceof FormData) {
        delete (hdrs as Record<string, string>)["Content-Type"];
        fetchOptions.headers = hdrs;
        fetchOptions.body = options.body as FormData;
      }

      const url = this.buildUrl(path, options?.params);
      return fetch(url, fetchOptions);
    };

    let res = await doRequest();

    // Auto-refresh on 401
    if (res.status === 401) {
      const refreshed = await this.refreshAuth();
      if (!refreshed) {
        await this.login();
      }
      res = await doRequest();
    }

    if (res.status === 204) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Taiga API error ${res.status} ${method} ${path}: ${text}`,
      );
    }

    return res.json();
  }

  async get(path: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.request("GET", path, { params });
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    return this.request("POST", path, { body });
  }

  async put(path: string, body?: unknown): Promise<unknown> {
    return this.request("PUT", path, { body });
  }

  async patch(path: string, body?: unknown): Promise<unknown> {
    return this.request("PATCH", path, { body });
  }

  async delete(path: string): Promise<unknown> {
    return this.request("DELETE", path);
  }

  async postMultipart(path: string, formData: FormData): Promise<unknown> {
    return this.request("POST", path, { body: formData, isMultipart: true });
  }

  // Fetch raw bytes (e.g. an attachment file) authenticated with the in-memory bearer token.
  // Accepts an absolute URL, an /api-relative path, or a bare media-relative path.
  //
  // Security: the bearer token is ONLY ever sent to the configured Taiga origin. A target
  // resolving to any other origin is refused (prevents SSRF / token exfiltration if a caller —
  // e.g. via prompt injection — supplies a hostile `url`). Redirects are followed manually so a
  // cross-origin hop (e.g. to an object store) is fetched WITHOUT the Authorization header.
  async getBinary(urlOrPath: string): Promise<ArrayBuffer> {
    await this.ensureAuth();
    const apiOrigin = new URL(this.baseUrl).origin;

    let target: URL;
    if (/^https?:\/\//i.test(urlOrPath)) {
      target = new URL(urlOrPath);
    } else if (urlOrPath.startsWith("/")) {
      target = new URL(urlOrPath, apiOrigin);
    } else {
      if (!/^[A-Za-z0-9_./-]+$/.test(urlOrPath) || urlOrPath.includes("..")) {
        throw new Error(`Invalid attachment path: ${urlOrPath}`);
      }
      target = new URL(`/media/${urlOrPath}`, apiOrigin);
    }

    if (target.origin !== apiOrigin) {
      throw new Error(
        `Refusing to fetch an attachment from a non-Taiga origin (${target.origin}); only ${apiOrigin} is allowed.`,
      );
    }

    let current = target;
    let triedRefresh = false;
    for (let hop = 0; hop < 6; hop++) {
      const sameOrigin = current.origin === apiOrigin;
      const res = await fetch(current.toString(), {
        // Only ever attach the bearer to the Taiga origin — never on a cross-origin redirect hop.
        headers: sameOrigin ? { Authorization: `Bearer ${this.authToken}` } : {},
        redirect: "manual",
      });

      if (res.status === 401 && sameOrigin && !triedRefresh) {
        triedRefresh = true;
        const refreshed = await this.refreshAuth();
        if (!refreshed) await this.login();
        hop--; // retry this hop with the refreshed token
        continue;
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) {
          throw new Error(`Taiga binary fetch: redirect ${res.status} without Location.`);
        }
        current = new URL(loc, current);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Taiga binary fetch failed ${res.status} GET ${current.origin}${current.pathname}: ${text}`,
        );
      }
      return res.arrayBuffer();
    }
    throw new Error("Taiga binary fetch: too many redirects.");
  }
}
