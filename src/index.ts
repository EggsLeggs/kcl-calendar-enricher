import { Hono } from 'hono'

import { ParseError, enrichCalendar } from './ics.ts'
import { PAGE } from './page.ts'
import { UpstreamError, ValidationError, fetchIcs } from './upstream.ts'

const app = new Hono<{ Bindings: Env }>()

// Turns a Scientia link into a subscribe link, so nobody has to hand-assemble a query string.
app.get('/', (c) => c.html(PAGE, 200, { 'cache-control': 'public, max-age=3600' }))

app.get('/health', (c) => c.text('OK', 200, { 'cache-control': 'no-store' }))

/**
 * Fetches a KCL timetable and returns it with each event's LOCATION filled in from its DESCRIPTION.
 *
 * The `?url=` shape is fixed: live calendar subscriptions point at it, and a subscription URL is not
 * something you can ask people to update. Workers Cache keys on path and query string together, so
 * each feed gets its own entry.
 */
app.get('/enrich', async (c) => {
  const source = c.req.query('url')
  if (source === undefined || source === '') {
    return c.text("Missing 'url' query parameter", 400)
  }

  try {
    const enriched = enrichCalendar(await fetchIcs(source))

    return c.body(enriched, 200, {
      'content-type': 'text/calendar; charset=utf-8',
      // Matches the five minute TTL the Java service kept in memory. stale-while-revalidate keeps a
      // slow Scientia response off the critical path once an entry has gone stale.
      'cache-control': 'public, max-age=300, stale-while-revalidate=600',
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.text(`Invalid URL: ${error.message}`, 400)
    }
    if (error instanceof UpstreamError) {
      return c.text(`Error fetching calendar: ${error.message}`, 502)
    }
    if (error instanceof ParseError) {
      return c.text(`Error parsing calendar: ${error.message}`, 502)
    }

    // Unlike the Java service, do not hand the caller the raw message. This endpoint is public.
    console.error(
      JSON.stringify({
        message: 'unhandled error in /enrich',
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    return c.text('Internal server error', 500)
  }
})

app.notFound((c) => c.text('Not found', 404))

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>
