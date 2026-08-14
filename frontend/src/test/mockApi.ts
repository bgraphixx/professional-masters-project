import { vi } from 'vitest';

export interface MockRoute {
  method: string;
  test: RegExp;
  handler: (url: string, init?: RequestInit) => { status: number; body: unknown };
}

/**
 * Installs a global fetch mock that dispatches to the given routes by
 * method + URL regex. Any call that matches no route returns 404 with a
 * descriptive body, so a missing mock fails loudly instead of hanging.
 */
export function installMockFetch(routes: MockRoute[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    const route = routes.find((r) => r.method === method && r.test.test(url));
    if (!route) {
      return new Response(JSON.stringify({ detail: `No mock route for ${method} ${url}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { status, body } = route.handler(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function jsonBody(init?: RequestInit): any {
  return init?.body ? JSON.parse(init.body as string) : {};
}
