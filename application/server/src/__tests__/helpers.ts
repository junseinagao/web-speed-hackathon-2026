import http from "node:http";

type RequestLikeApp = {
  request(input: string | Request, init?: RequestInit): Response | Promise<Response>;
};

type ListenableRequestHandler = http.RequestListener & {
  listen?: (...args: unknown[]) => http.Server;
};

export type TestApp = {
  request(input: string | Request, init?: RequestInit): Promise<Response>;
  close?(): Promise<void>;
};

export function createHonoTestApp(app: RequestLikeApp): TestApp {
  return {
    async request(input, init) {
      return await app.request(input, init);
    },
  };
}

export async function createNodeHttpTestApp(handler: ListenableRequestHandler): Promise<TestApp> {
  const listen = handler.listen;
  const server =
    typeof listen === "function"
      ? await new Promise<http.Server>((resolve, reject) => {
          const listeningServer = listen.call(handler, 0, "127.0.0.1", () => {
            listeningServer.off("error", reject);
            resolve(listeningServer);
          });
          listeningServer.once("error", reject);
        })
      : await new Promise<http.Server>((resolve, reject) => {
          const listeningServer = http.createServer(handler);
          listeningServer.once("error", reject);
          listeningServer.listen(0, "127.0.0.1", () => {
            listeningServer.off("error", reject);
            resolve(listeningServer);
          });
        });

  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("Failed to start test HTTP server");
  }
  server.unref();

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    async request(input, init) {
      const request = typeof input === "string" ? new Request(new URL(input, baseUrl), init) : input;
      const url = new URL(request.url, baseUrl);
      if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
        url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
      }
      return await fetch(url, init ?? request);
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error != null) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

export async function signupAndGetCookie(
  app: TestApp,
  username = "testuser",
  password = "testpass123",
): Promise<{ cookie: string; body: Record<string, unknown> }> {
  const res = await app.request("/api/v1/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, name: username }),
  });
  const cookie = res.headers.get("set-cookie") ?? "";
  const body = (await res.json()) as Record<string, unknown>;
  return { cookie, body };
}

export function requestWithSession(
  app: TestApp,
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { Cookie: cookie };
  let reqBody: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    reqBody = JSON.stringify(body);
  }
  return app.request(path, { method, headers, body: reqBody });
}
