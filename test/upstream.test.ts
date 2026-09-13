import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UpstreamError, ValidationError, fetchIcs, validateUrl } from '../src/upstream.ts'
import { noLocationRedirect, ok, redirect, serve, status, stubFetch } from './fetch-stub.ts'
import fixture from './fixtures/timetable.ics?raw'

const ORIGIN = 'https://scientia-eu-v4-api-d4-02.azurewebsites.net'
const PATH = '/api/ical/REDACTED-TIMETABLE-ID/REDACTED-TIMETABLE-ID/timetable.ics'
const VALID = `${ORIGIN}${PATH}`

describe('validateUrl', () => {
  it('accepts a valid KCL Scientia URL', () => {
    expect(validateUrl(VALID).hostname).toBe('scientia-eu-v4-api-d4-02.azurewebsites.net')
  })

  it('accepts the double slash KCL actually publishes', () => {
    expect(validateUrl(`${ORIGIN}/${PATH}`).pathname.startsWith('//api/ical/')).toBe(true)
  })

  it('accepts a mixed case host', () => {
    // The Java check was a case sensitive String.equals, so this used to be rejected.
    expect(() =>
      validateUrl(`https://Scientia-EU-v4-API-d4-02.AzureWebsites.NET${PATH}`),
    ).not.toThrow()
  })

  it('rejects a non-HTTPS URL', () => {
    expect(() => validateUrl(`http://scientia-eu-v4-api-d4-02.azurewebsites.net${PATH}`)).toThrow(
      /HTTPS/,
    )
  })

  it('rejects another domain', () => {
    expect(() => validateUrl('https://malicious-site.com/api/ical/test/timetable.ics')).toThrow(
      /scientia-eu-v4-api-d4-02\.azurewebsites\.net/,
    )
  })

  it('rejects a different azurewebsites.net host', () => {
    expect(() =>
      validateUrl('https://other-scientia.azurewebsites.net/api/ical/test/timetable.ics'),
    ).toThrow(/scientia-eu-v4-api-d4-02\.azurewebsites\.net/)
  })

  it('rejects a non-ics file', () => {
    expect(() => validateUrl(`${ORIGIN}/api/ical/test/timetable.txt`)).toThrow(/timetable\.ics/)
  })

  it('rejects an ics file that is not timetable.ics', () => {
    expect(() => validateUrl(`${ORIGIN}/api/ical/test/calendar.ics`)).toThrow(/timetable\.ics/)
  })

  it('rejects the wrong path prefix', () => {
    expect(() => validateUrl(`${ORIGIN}/other/path/test/timetable.ics`)).toThrow(/api\/ical\//)
  })

  it('rejects a malformed URL', () => {
    expect(() => validateUrl('not a url')).toThrow(ValidationError)
  })
})

describe('fetchIcs', () => {
  beforeEach(stubFetch)
  afterEach(() => vi.unstubAllGlobals())

  it('rejects an empty URL without fetching', async () => {
    await expect(fetchIcs('')).rejects.toThrow(ValidationError)
  })

  it('returns the body of a 200', async () => {
    serve(PATH, () => ok(fixture))

    await expect(fetchIcs(VALID)).resolves.toBe(fixture)
  })

  it('returns a calendar that declares VERSION:2.0', async () => {
    serve(PATH, () => ok(fixture))

    expect(await fetchIcs(VALID)).toContain('VERSION:2.0')
  })

  it('turns a non-200 into an UpstreamError', async () => {
    serve(PATH, () => status(404, 'nope'))

    await expect(fetchIcs(VALID)).rejects.toThrow(/HTTP 404/)
  })

  it('follows a redirect that stays inside the allowlist', async () => {
    const target = '/api/ical/moved/aaa/timetable.ics'
    serve(PATH, () => redirect(`${ORIGIN}${target}`))
    serve(target, () => ok(fixture))

    await expect(fetchIcs(VALID)).resolves.toBe(fixture)
  })

  it('refuses a redirect that leaves the allowlist', async () => {
    // The JDK client followed redirects internally, so this used to be fetched.
    serve(PATH, () => redirect('https://evil.example/api/ical/x/timetable.ics'))

    await expect(fetchIcs(VALID)).rejects.toThrow(ValidationError)
  })

  it('refuses a redirect that downgrades to http', async () => {
    serve(PATH, () => redirect(`http://scientia-eu-v4-api-d4-02.azurewebsites.net${PATH}`))

    await expect(fetchIcs(VALID)).rejects.toThrow(/HTTPS/)
  })

  it('rejects a redirect with no Location header', async () => {
    serve(PATH, noLocationRedirect)

    await expect(fetchIcs(VALID)).rejects.toThrow(UpstreamError)
  })

  it('gives up on a redirect loop', async () => {
    serve(PATH, () => redirect(VALID))

    await expect(fetchIcs(VALID)).rejects.toThrow(/Too many redirects/)
  })

  it('wraps a network failure as an UpstreamError', async () => {
    serve(PATH, () => {
      throw new Error('connection reset')
    })

    await expect(fetchIcs(VALID)).rejects.toThrow(UpstreamError)
  })
})
