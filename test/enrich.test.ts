import { SELF } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ok, serve, status, stubFetch } from './fetch-stub.ts'
import fixture from './fixtures/timetable.ics?raw'

const ORIGIN = 'https://scientia-eu-v4-api-d4-02.azurewebsites.net'
const PATH = '/api/ical/00000000-0000-4000-8000-000000000000/11111111-1111-4111-8111-111111111111/timetable.ics'
const VALID = `${ORIGIN}${PATH}`

const enrich = (url: string): Promise<Response> =>
  SELF.fetch(`https://enricher.test/enrich?url=${encodeURIComponent(url)}`)

describe('GET /', () => {
  it('serves the link builder', async () => {
    const response = await SELF.fetch('https://enricher.test/')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')

    const body = await response.text()
    expect(body).toContain('<form id="form"')
    expect(body).toContain('/enrich?url=')
  })

  it('keeps its client-side host check in step with the server', async () => {
    // String.raw must survive into the served HTML, or the regex silently matches the wrong thing.
    const body = await (await SELF.fetch('https://enricher.test/')).text()

    expect(body).toContain(String.raw`/^scientia-eu-v4-api-d\d{1,2}-\d{1,2}\.azurewebsites\.net$/`)
  })

  it('builds subscribe links from location.origin, never a hard-coded hostname', async () => {
    // The service has already moved hostname once. A baked-in origin would hand people links to
    // whichever domain happened to be current when the page was written.
    const body = await (await SELF.fetch('https://enricher.test/')).text()

    expect(body).toContain('location.origin')
    expect(body).not.toMatch(/https:\/\/kcl-calendar-enricher\.[a-z.]+\/enrich/)
  })
})

describe('GET /health', () => {
  it('returns OK and asks not to be cached', async () => {
    const response = await SELF.fetch('https://enricher.test/health')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('GET /enrich', () => {
  beforeEach(stubFetch)
  afterEach(() => vi.unstubAllGlobals())

  it('returns an enriched calendar as text/calendar', async () => {
    serve(PATH, () => ok(fixture))

    const response = await enrich(VALID)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(await response.text()).toContain('33-41 Surrey St')
  })

  it('asks clients to cache for five minutes', async () => {
    serve(PATH, () => ok(fixture))

    const response = await enrich(VALID)

    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=300, stale-while-revalidate=600',
    )
  })

  it('maps a location into an event that had none', async () => {
    serve(PATH, () => ok(fixture))

    expect(await (await enrich(VALID)).text()).toContain('Franklin-Wilkins Building')
  })

  it('preserves the original events and calendar version', async () => {
    serve(PATH, () => ok(fixture))

    const body = await (await enrich(VALID)).text()

    expect(body).toContain('VERSION:2.0')
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(6)
    for (const uid of [1, 2, 3, 4, 5, 6]) {
      expect(body).toContain(`UID:event-${uid}@scientia.example`)
    }
  })

  it('leaves the room detail in the DESCRIPTION untouched', async () => {
    serve(PATH, () => ok(fixture))

    expect(await (await enrich(VALID)).text()).toContain('KINGS BLDG KIN 625')
  })

  it('returns 400 when url is missing', async () => {
    const response = await SELF.fetch('https://enricher.test/enrich')

    expect(response.status).toBe(400)
    expect(await response.text()).toBe("Missing 'url' query parameter")
  })

  it('returns 400 when url is empty', async () => {
    expect((await SELF.fetch('https://enricher.test/enrich?url=')).status).toBe(400)
  })

  it('returns 400 for a URL outside the allowlist', async () => {
    const response = await enrich('https://malicious-site.com/api/ical/x/timetable.ics')

    expect(response.status).toBe(400)
    expect(await response.text()).toContain('Invalid URL:')
  })

  it('returns 502 when the upstream fails', async () => {
    serve(PATH, () => status(503, 'unavailable'))

    const response = await enrich(VALID)

    expect(response.status).toBe(502)
    expect(await response.text()).toContain('Error fetching calendar:')
  })

  it('returns 502 when the upstream body is not a calendar', async () => {
    serve(PATH, () => ok('<html>maintenance</html>'))

    const response = await enrich(VALID)

    expect(response.status).toBe(502)
    expect(await response.text()).toContain('Error parsing calendar:')
  })
})

describe('unknown routes', () => {
  it('returns 404, including for the removed subscribe endpoint', async () => {
    expect((await SELF.fetch('https://enricher.test/subscribe/anything')).status).toBe(404)
  })
})
