export class TaigaClient {
    baseUrl;
    username;
    password;
    authToken = null;
    refreshToken = null;
    constructor() {
        const url = process.env.TAIGA_URL;
        const username = process.env.TAIGA_USERNAME;
        const password = process.env.TAIGA_PASSWORD;
        if (!url || !username || !password) {
            throw new Error("Missing required environment variables: TAIGA_URL, TAIGA_USERNAME, TAIGA_PASSWORD");
        }
        this.baseUrl = url.replace(/\/+$/, "");
        if (!this.baseUrl.includes("/api/v1")) {
            this.baseUrl += "/api/v1";
        }
        this.username = username;
        this.password = password;
    }
    async login() {
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
    async refreshAuth() {
        if (!this.refreshToken)
            return false;
        try {
            const res = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh: this.refreshToken }),
            });
            if (!res.ok)
                return false;
            const data = await res.json();
            this.authToken = data.auth_token;
            this.refreshToken = data.refresh ?? this.refreshToken;
            return true;
        }
        catch {
            return false;
        }
    }
    async ensureAuth() {
        if (!this.authToken) {
            await this.login();
        }
    }
    async headers() {
        await this.ensureAuth();
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.authToken}`,
        };
    }
    buildUrl(path, params) {
        const url = new URL(`${this.baseUrl}${path}`);
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        url.searchParams.set(key, value.join(","));
                    }
                    else {
                        url.searchParams.set(key, String(value));
                    }
                }
            }
        }
        return url.toString();
    }
    async request(method, path, options) {
        const doRequest = async () => {
            const hdrs = await this.headers();
            const fetchOptions = { method, headers: hdrs };
            if (options?.body && !options?.isMultipart) {
                fetchOptions.body = JSON.stringify(options.body);
            }
            else if (options?.isMultipart && options.body instanceof FormData) {
                delete hdrs["Content-Type"];
                fetchOptions.headers = hdrs;
                fetchOptions.body = options.body;
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
            throw new Error(`Taiga API error ${res.status} ${method} ${path}: ${text}`);
        }
        return res.json();
    }
    async get(path, params) {
        return this.request("GET", path, { params });
    }
    async post(path, body) {
        return this.request("POST", path, { body });
    }
    async put(path, body) {
        return this.request("PUT", path, { body });
    }
    async patch(path, body) {
        return this.request("PATCH", path, { body });
    }
    async delete(path) {
        return this.request("DELETE", path);
    }
    async postMultipart(path, formData) {
        return this.request("POST", path, { body: formData, isMultipart: true });
    }
    // Fetch raw bytes (e.g. an attachment file) authenticated with the in-memory bearer token.
    // Accepts an absolute URL, an /api-relative path, or a bare media-relative path. The token
    // never leaves this process. Follows redirects and retries once after a 401 refresh.
    async getBinary(urlOrPath) {
        await this.ensureAuth();
        const origin = new URL(this.baseUrl).origin;
        let target;
        if (/^https?:\/\//i.test(urlOrPath)) {
            target = urlOrPath;
        }
        else if (urlOrPath.startsWith("/")) {
            target = origin + urlOrPath;
        }
        else {
            target = `${origin}/media/${urlOrPath}`;
        }
        const fetchOnce = () => fetch(target, {
            headers: { Authorization: `Bearer ${this.authToken}` },
            redirect: "follow",
        });
        let res = await fetchOnce();
        if (res.status === 401) {
            const refreshed = await this.refreshAuth();
            if (!refreshed)
                await this.login();
            res = await fetchOnce();
        }
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Taiga binary fetch failed ${res.status} GET ${target}: ${text}`);
        }
        return res.arrayBuffer();
    }
}
//# sourceMappingURL=client.js.map