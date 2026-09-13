# kcl-calendar-enricher

KCL's timetable feed leaves `LOCATION` as a bare room code, so calendar apps show "KIN 625" and
cannot map it. Everything else useful about the event is buried in a block of prose in the
description, where no calendar app will look. This Cloudflare Worker sits in front of the feed and
lifts that prose into the properties the iCalendar spec already has for it.

Everything else in the feed is passed through byte for byte. There is no database, no build step
and nothing to remember.

**Before**

```
LOCATION:KIN 625
DESCRIPTION:Event type: Lecture\nDescription: AGENTS AND MULTI-AGENT SYSTEMS\n
 Location: KINGS BLDG KIN 625 (Anatomy Lecture Theatre)\n
 Staff: Sarkadi\, Stefan\, Black\, Elizabeth\n...
```

**After**

```
LOCATION:33-41 Surrey St\, London\, WC2R 2ND\, England
GEO:51.5115;-0.116
CATEGORIES:Lecture
CONTACT:Sarkadi\, Stefan\, Black\, Elizabeth
DESCRIPTION:Event type: Lecture\nDescription: AGENTS AND MULTI-AGENT SYSTEMS\n
 Location: KINGS BLDG KIN 625 (Anatomy Lecture Theatre)\n
 Staff: Sarkadi\, Stefan\, Black\, Elizabeth\n...
```

The room detail stays in the description, so nothing is lost.

## What it fills in

| Property | Where it comes from | What you get |
| --- | --- | --- |
| `LOCATION` | the `Location:` line, building code expanded | an address your calendar app can search |
| `GEO` | the building the code names | a map pin, and travel time, with no geocoding |
| `CATEGORIES` | the `Event type:` line | lectures, practicals and seminars you can filter or colour |
| `CONTACT` | the `Staff:` line | who is teaching, without reading the description |
| `REFRESH-INTERVAL` and `X-PUBLISHED-TTL` | the five minute cache in front of the feed | a room change that shows up today, not tomorrow |

`LOCATION` is the one that gets overwritten, because a bare room code is the bug this exists to fix.
The rest are only added when KCL has not sent them itself.

The last row is one fact in two spellings: `REFRESH-INTERVAL` is the standard property and
`X-PUBLISHED-TTL` is the older one Outlook and Apple Calendar actually read. They go out together
or not at all, so a feed that already sets either keeps its own answer rather than getting a second
one beside it.

Coordinates are building entrances and are approximate: close enough for a pin sitting beside the
full address, not a survey.

## What is live

| Hostname | What it does |
| --- | --- |
| `kcl-calendar-enricher.amory.me` | The service |
| `kcl-calendar-enricher.thinkhuman.dev` | 301s to the above, path and query kept |

The old hostname is a redirect held in [ThinkHumanDotDev/redirects](https://github.com/ThinkHumanDotDev/redirects),
not something this Worker serves. Subscriptions created before the rename keep working.

## Using it

Go to **https://kcl-calendar-enricher.amory.me**, paste your KCL timetable link, and it gives you a
subscribe link to add to your calendar app. Add it as a subscribed or internet calendar rather than
an import, so it keeps updating.

Your timetable URL comes from KCL's timetable system and looks like
`https://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/<uuid>/<uuid>/timetable.ics`. Any
Scientia shard works, not just `d4-02`. Nothing else is accepted: only HTTPS Scientia timetable URLs
are fetched, so this cannot be used as a general proxy.

That link is personal to you and is the only thing protecting your timetable, so treat it like a
password. Do not paste it into issues, commits or screenshots.

## Endpoints

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | `/` | Link builder. Paste a timetable URL, get a subscribe link. |
| GET | `/health` | Returns `OK`. |
| GET | `/enrich?url=<ics-url>` | Fetches, enriches and returns the calendar as `text/calendar`. |

400 for a missing or disallowed `url`, 502 when the upstream fetch fails or returns something that
is not a calendar, 500 otherwise. A successful `/enrich` carries
`Cache-Control: public, max-age=300, stale-while-revalidate=600`, and Workers Cache serves repeat
requests without invoking the Worker at all. Errors are not cached, `/health` is `no-store`, and the
page at `/` is cached for an hour.

## Deploying

Add these two repository secrets once, under Settings, then Secrets and variables, then Actions:

| Secret | Where it comes from |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | An API token with the Edit Cloudflare Workers template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard, right hand column of the account overview |

The Worker itself needs no secrets: it has no bindings, no `vars` and nothing that reads `env`.
`wrangler secret put` is never needed here.

After that there are three ways to deploy, and they all do the same thing:

- Push to `main`. This is the usual one, and typecheck and tests gate it.
- Actions, then Deploy, then Run workflow. One click, deploys whatever `main` holds.
- `pnpm deploy` locally, once `pnpm wrangler login` has run.

### The Deploy to Cloudflare button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/EggsLeggs/kcl-calendar-enricher)

The button stands up a separate copy: Cloudflare clones this repo into your own GitHub account,
deploys the clone, and watches that clone from then on. It is the right thing for running your own
enricher, and the wrong thing for changing this one, which is what the workflow above is for.

A fresh copy answers on its own `workers.dev` subdomain, and the link builder at `/` follows
whatever hostname it is served from, so there is nothing to edit before it works.

## Local development

```bash
pnpm install
pnpm test        # 93 tests in the Workers runtime, no network access needed
pnpm typecheck
pnpm dev         # http://localhost:8787
```

Tests run inside the Workers runtime via `@cloudflare/vitest-pool-workers`, against
`test/fixtures/timetable.ics`. There is no live feed dependency and no secret to set.

## How it works

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Hono app. Three routes, the status mapping, the cache headers. |
| `src/page.ts` | The link builder served at `/`. |
| `src/upstream.ts` | The Scientia allowlist, and fetching with hand-followed redirects. |
| `src/ics.ts` | Unfold, unescape, write the managed properties, re-escape, refold. |
| `src/parser.ts` | The five regexes that read a KCL `DESCRIPTION`. |
| `src/locations.ts` | Building code to street address and coordinate. |

The ICS is rewritten as text, line by line, rather than parsed into an object model and serialised
back. Only the properties in the table above change; every other property keeps its original bytes
and its original folding. The one thing normalised throughout is line endings, which are always
CRLF on the way out, as RFC 5545 requires.

## Adding a building

Add a `Place` with its address and coordinate to `src/locations.ts`, list the code against it in
`MAPPINGS`, then add a case to `test/locations.test.ts`. Codes match on whole words, and an underscore in a code matches an
underscore, a space, or nothing, so `KINGS_BLDG` covers "KINGS BLDG", "KINGS_BLDG" and "KINGSBLDG".
The first entry that matches wins, so put more specific codes above shorter ones.

## Turning it off

```bash
pnpm wrangler delete kcl-calendar-enricher
```

That deletes the Worker with its custom domain and the DNS record Cloudflare created for it, which
is the whole footprint. There is no database, queue, KV namespace or stored secret to clean up.

What is left afterwards is only outside Cloudflare:

- The redirect in `ThinkHumanDotDev/redirects`, which would then point at nothing. Remove both
  halves of it there.
- The two repository secrets, if you want them gone.
- This repository, and anyone's calendar subscription pointing at a hostname that no longer answers.

## Licence

MIT. A personal project, and not affiliated with King's College London.
