/**
 * Fetches ICS documents from KCL's Scientia timetabling service.
 *
 * The allowlist is the same one the Java `CalendarFetcher` enforced, with two fixes. Host
 * comparison is now case insensitive, and redirects are followed by hand so each hop is checked
 * against the allowlist - the JDK client followed them internally, which let an upstream redirect
 * step outside the allowlist and turn this into an open proxy.
 */

/**
 * KCL issues timetable links across several Scientia shards - d4-02, d4-01, d3-02 and so on - so
 * the allowlist covers the family rather than the single host the original author happened to be
 * issued. It is still tightly scoped: nothing outside Scientia matches.
 */
const ALLOWED_HOST = /^scientia-eu-v4-api-d\d{1,2}-\d{1,2}\.azurewebsites\.net$/
const ALLOWED_HOST_DESCRIPTION = 'scientia-eu-v4-api-d<n>-<nn>.azurewebsites.net'

const TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 3
const USER_AGENT = 'kcl-calendar-enricher (+https://kcl-calendar-enricher.amory.me)'

/** The caller gave us a URL we will not fetch. Surfaces as a 400. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError'
}

/** We tried to fetch and could not. Surfaces as a 502. */
export class UpstreamError extends Error {
  override readonly name = 'UpstreamError'
}

/**
 * Accepts only HTTPS Scientia timetable URLs.
 *
 * The `//api/ical/` form is not a typo: KCL genuinely publishes subscribe links with a double
 * slash after the host, and rejecting them would break every existing subscription.
 */
export function validateUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ValidationError(`Invalid URL format: ${raw}`)
  }

  if (url.protocol !== 'https:') {
    throw new ValidationError('Only HTTPS URLs are allowed')
  }

  if (!ALLOWED_HOST.test(url.hostname.toLowerCase())) {
    throw new ValidationError(
      `Only KCL Scientia calendar URLs (${ALLOWED_HOST_DESCRIPTION}) are allowed`,
    )
  }

  if (!url.pathname.startsWith('/api/ical/') && !url.pathname.startsWith('//api/ical/')) {
    throw new ValidationError('URL path must start with /api/ical/ or //api/ical/')
  }

  if (!url.pathname.endsWith('/timetable.ics')) {
    throw new ValidationError('URL must end with /timetable.ics')
  }

  return url
}

/**
 * Fetches an ICS document, following up to three redirects and re-validating each one.
 *
 * @throws ValidationError if the URL, or a redirect target, is not an allowed Scientia URL.
 * @throws UpstreamError on a network failure, a timeout, or any status other than 200.
 */
export async function fetchIcs(raw: string): Promise<string> {
  if (raw === '') {
    throw new ValidationError('URL cannot be null or empty')
  }

  let url = validateUrl(raw)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8',
        },
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new UpstreamError(reason)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location === null) {
        throw new UpstreamError(`HTTP ${response.status} with no Location header`)
      }
      // Resolving the header can throw on its own: a garbage Location is an upstream fault, not a
      // caller fault, so it has to become an UpstreamError rather than escaping as a 500. The
      // allowlist check stays outside, where a well formed but disallowed target still means 400.
      let target: URL
      try {
        target = new URL(location, url)
      } catch {
        throw new UpstreamError(`HTTP ${response.status} with an invalid Location header`)
      }
      url = validateUrl(target.toString())
      continue
    }

    if (response.status !== 200) {
      throw new UpstreamError(`Failed to fetch calendar: HTTP ${response.status}`)
    }

    // Reading the body is a second chance to fail: the connection can drop part way through one
    // of these, and a 200 with a truncated body is still an upstream fault rather than ours.
    try {
      return await response.text()
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new UpstreamError(`Failed to read calendar body: ${reason}`)
    }
  }

  throw new UpstreamError(`Too many redirects (more than ${MAX_REDIRECTS})`)
}
