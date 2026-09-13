import { vi } from 'vitest'

/**
 * Routes outbound `fetch` by pathname.
 *
 * The worker under test runs in the same isolate as the tests, so stubbing the global covers both
 * direct calls into `src/upstream.ts` and calls the worker makes when reached through `SELF`.
 */

type Handler = (url: URL) => Response

const routes = new Map<string, Handler>()

export function stubFetch(): void {
  routes.clear()
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const href =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    const url = new URL(href)

    const handler = routes.get(url.pathname)
    if (handler === undefined) {
      throw new Error(`unexpected outbound fetch: ${url.href}`)
    }

    return handler(url)
  })
}

export function serve(path: string, handler: Handler): void {
  routes.set(path, handler)
}

export const ok = (body: string): Response => new Response(body, { status: 200 })

export const status = (code: number, body = ''): Response => new Response(body, { status: code })

export const redirect = (to: string, code = 302): Response =>
  new Response(null, { status: code, headers: { location: to } })

export const noLocationRedirect = (): Response => new Response(null, { status: 302 })
