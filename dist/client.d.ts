export declare class TaigaClient {
    private baseUrl;
    private username;
    private password;
    private authToken;
    private refreshToken;
    constructor();
    private login;
    private refreshAuth;
    private ensureAuth;
    private headers;
    private buildUrl;
    private request;
    get(path: string, params?: Record<string, unknown>): Promise<unknown>;
    post(path: string, body?: unknown): Promise<unknown>;
    put(path: string, body?: unknown): Promise<unknown>;
    patch(path: string, body?: unknown): Promise<unknown>;
    delete(path: string): Promise<unknown>;
    postMultipart(path: string, formData: FormData): Promise<unknown>;
}
//# sourceMappingURL=client.d.ts.map