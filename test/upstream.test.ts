import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UpstreamError, ValidationError, fetchIcs, validateUrl } from '../src/upstream.ts'
import { noLocationRedirect, ok, redirect, serve, status, stubFetch } from './fetch-stub.ts'
import fixture from './fixtures/timetable.ics?raw'

const ORIGIN = 'https://scientia-eu-v4-api-d4-02.azurewebsites.net'
const PATH = '/api/ical/00000000-0000-4000-8000-000000000000/11111111-1111-4111-8111-111111111111/timetable.ics'
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

  it('accepts any Scientia shard, not just the one this repo was written against', () => {
    // Other students are issued links on other shards. Rejecting those made the tool look broken.
    for (const host of [
      'scientia-eu-v4-api-d4-01.azurewebsites.net',
      'scientia-eu-v4-api-d3-02.azurewebsites.net',
      'scientia-eu-v4-api-d10-11.azurewebsites.net',
    ]) {
      expect(() => validateUrl(`https://${host}${PATH}`)).not.toThrow()
    }
  })

  it('rejects another domain', () => {
    expect(() => validateUrl('https://malicious-site.com/api/ical/test/timetable.ics')).toThrow(
      /Only KCL Scientia calendar URLs/,
    )
  })

  it('rejects a different azurewebsites.net host', () => {
    expect(() =>
      validateUrl('https://other-scientia.azurewebsites.net/api/ical/test/timetable.ics'),
    ).toThrow(/Only KCL Scientia calendar URLs/)
  })

  it('rejects hosts that only look like a Scientia shard', () => {
    for (const host of [
      'scientia-eu-v5-api-d4-02.azurewebsites.net',
      'scientia-eu-v4-api-d4-02.azurewebsites.net.evil.example',
      'evil-scientia-eu-v4-api-d4-02.azurewebsites.net',
      'scientia-eu-v4-api-dx-02.azurewebsites.net',
    ]) {
      expect(() => validateUrl(`https://${host}${PATH}`)).toThrow(/Only KCL Scientia calendar URLs/)
    }
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
