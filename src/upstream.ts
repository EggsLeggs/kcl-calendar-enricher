/**
 * Fetches ICS documents from KCL's Scientia timetabling service.
 *
 * The allowlist is the same one the Java `CalendarFetcher` enforced, with two fixes. Host
 * comparison is now case insensitive, and redirects are followed by hand so each hop is checked
 * against the allowlist - the JDK client followed them internally, which let an upstream redirect
 * step outside the allowlist and turn this into an open proxy.
 */

const ALLOWED_HOST = 'scientia-eu-v4-api-d4-02.azurewebsites.net'
const TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 3
const USER_AGENT = 'kcl-calendar-enricher (+https://kcl-calendar-enricher.thinkhuman.dev)'

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

  if (url.hostname.toLowerCase() !== ALLOWED_HOST) {
    throw new ValidationError(`Only KCL Scientia calendar URLs (${ALLOWED_HOST}) are allowed`)
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
      url = validateUrl(new URL(location, url).toString())
      continue
    }

    if (response.status !== 200) {
      throw new UpstreamError(`Failed to fetch calendar: HTTP ${response.status}`)
    }

    return await response.text()
  }

  throw new UpstreamError(`Too many redirects (more than ${MAX_REDIRECTS})`)
}
