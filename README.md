# KCL Calendar Enricher

KCL's Scientia timetable feed puts the room in the event description and leaves `LOCATION` as a bare
room code, so calendar apps cannot map it. This service sits in front of the feed, reads the
`Location:` line out of each event's description, expands the building code to a full street
address, and writes it back into `LOCATION`.

Everything else in the feed is passed through byte for byte.

**Before**

```
LOCATION:KIN 625
DESCRIPTION:Event type: Lecture\nDescription: AGENTS AND MULTI-AGENT SYSTEMS\n
 Location: KINGS BLDG KIN 625 (Anatomy Lecture Theatre)\n...
```

**After**

```
LOCATION:33-41 Surrey St\, London\, WC2R 2ND\, England
DESCRIPTION:Event type: Lecture\nDescription: AGENTS AND MULTI-AGENT SYSTEMS\n
 Location: KINGS BLDG KIN 625 (Anatomy Lecture Theatre)\n...
```

The room detail stays in the description, so nothing is lost.

## Using it

Subscribe your calendar app to:

```
https://kcl-calendar-enricher.thinkhuman.dev/enrich?url=<your-kcl-timetable-url>
```

Your timetable URL comes from KCL's timetable site and looks like
`https://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/<uuid>/<uuid>/timetable.ics`. Nothing
else is accepted: only HTTPS Scientia timetable URLs get fetched, so this cannot be used as a
general proxy.

## Endpoints

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | `/health` | Returns `OK`. |
| GET | `/enrich?url=<ics-url>` | Fetches, enriches and returns the calendar as `text/calendar`. |

Errors follow the original service: 400 for a missing or disallowed `url`, 502 when the upstream
fetch fails or returns something that is not a calendar, 500 otherwise.

Responses carry `Cache-Control: public, max-age=300, stale-while-revalidate=600`, and Workers Cache
serves repeat requests without invoking the Worker.

## Development

Node 22 and pnpm.

```bash
pnpm install
pnpm dev        # wrangler dev on http://localhost:8787
pnpm test       # 74 tests, no network access needed
pnpm typecheck
```

Tests run inside the Workers runtime via `@cloudflare/vitest-pool-workers`, against
`test/fixtures/timetable.ics`. There is no live-feed dependency and no secret to set.

## Adding a building

Add the code and its address to `MAPPINGS` in `src/locations.ts`, then add a case to
`test/locations.test.ts`. Codes match on whole words, and an underscore in a code matches an
underscore, a space, or nothing, so `KINGS_BLDG` covers "KINGS BLDG", "KINGS_BLDG" and "KINGSBLDG".
The first entry that matches wins, so put more specific codes above shorter ones.

## Deployment

A Cloudflare Worker on `kcl-calendar-enricher.thinkhuman.dev`, deployed by
`.github/workflows/deploy.yml` on every push to `main` that touches the Worker. Typecheck and tests
gate the deploy.

```bash
pnpm deploy     # or let CI do it
```

The Worker needs no bindings, no secrets and no `nodejs_compat`.

## Not affiliated with King's College London.
