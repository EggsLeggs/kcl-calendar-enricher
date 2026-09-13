import { SELF } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ok, serve, status, stubFetch } from './fetch-stub.ts'
import fixture from './fixtures/timetable.ics?raw'

const ORIGIN = 'https://scientia-eu-v4-api-d4-02.azurewebsites.net'
const PATH = '/api/ical/REDACTED-TIMETABLE-ID/REDACTED-TIMETABLE-ID/timetable.ics'
const VALID = `${ORIGIN}${PATH}`

const enrich = (url: string): Promise<Response> =>
  SELF.fetch(`https://enricher.test/enrich?url=${encodeURIComponent(url)}`)

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
