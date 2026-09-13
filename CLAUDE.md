# KCL Calendar Enricher

A Cloudflare Worker that proxies a KCL Scientia ICS timetable and fills in each event's `LOCATION`
from the `Location:` line inside its `DESCRIPTION`. Deployed to
`kcl-calendar-enricher.amory.me`. No bindings, no secrets, no database.

`kcl-calendar-enricher.thinkhuman.dev` is the hostname this used to answer on. It is now a 301
held in `ThinkHumanDotDev/redirects`, keeping path and query so subscriptions made before the
rename still resolve. Nothing here serves it, and nothing here should hard-code either hostname:
`src/page.ts` builds links from `location.origin` and a test enforces that.

## The one architectural rule

**Only `LOCATION` changes.** The ICS is rewritten as text, line by line, so every other property
survives byte for byte including its original folding. Do not introduce an ICS object model: a
parse-and-reserialise would rewrite the whole document to its own conventions and drift from what
KCL sent, for no gain. `test/ics.test.ts` asserts this directly, by diffing every non-`LOCATION`
line before and after.

## Layout

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Hono app. Three routes, the status mapping, and the cache headers. |
| `src/page.ts` | The link builder served at `/`. One static string, no dependencies. |
| `src/upstream.ts` | The Scientia allowlist, and fetching with hand-followed redirects. |
| `src/ics.ts` | Unfold, unescape, swap `LOCATION`, re-escape, refold. |
| `src/parser.ts` | The five regexes that read a KCL `DESCRIPTION`. |
| `src/locations.ts` | Building code to street address. |

The page at `/` repeats the host check from `src/upstream.ts` in its client-side JavaScript, so a
wrong URL is caught before someone subscribes to a 400. **Change the two together**; a test asserts
the regex literal survives into the served HTML.

## Conventions

**Keep it small.** This is 400-odd lines doing one thing. Write the direct version; add an
abstraction when a second caller exists, not before.

**No `nodejs_compat`.** Everything used here is on the bare Workers runtime. If something seems to
need a Node built-in, it is the wrong approach.

**British English** in prose, comments and UI copy.

**Punctuation.** Plain ASCII throughout: hyphen `-`, straight quotes, `...` for an ellipsis. Where a
dash would join a range or an aside, write `to`, a comma, or a full stop.

## Things that look like bugs but are not

- `//api/ical/` with a double slash is accepted because KCL genuinely publishes subscribe links that
  way. Rejecting it would break every existing subscription.
- `KINGS_BDLG` is a deliberate alias for a typo that appears in real feeds.
- The parser's regexes carry no flags on purpose. Java's default `$` means end of input and so does
  JavaScript's without `m`; adding `m` or `s` would change which text each field captures.
- An unmapped location still overwrites `LOCATION` with the raw text from the `DESCRIPTION`. That is
  what the original Java did, and it is better than leaving a bare room code.
- A `VALARM` carries its own `DESCRIPTION`. `enrichEvent` tracks nesting depth so it reads the
  event's, not the reminder's.
- The allowlist is a pattern over the whole Scientia shard family, not one host. KCL issues
  different students links on different shards, and pinning `d4-02` returned 400 for everyone else.

## The subscribe URL is the credential

Scientia applies no authentication: whoever holds the URL can read the timetable. Two consequences.

`Cache-Control: public` is deliberate and necessary - Workers Cache will not store the response
otherwise - so an enriched timetable does sit in a shared cache. That is acceptable only because the
cache key includes the query string, which means the entry is reachable only by someone who already
knows the full URL. Do not move the upstream URL out of the query string, and do not add a route
that would serve one person's feed under a key another person can guess.

Never commit a real subscribe URL, in a test, a doc, or an example. One was committed to this public
repo in October 2025 and stayed there for eleven months. Test fixtures use obviously fake UUIDs.

## Testing

```bash
pnpm test       # 79 tests in the Workers runtime, no network
pnpm typecheck
```

Everything runs against `test/fixtures/timetable.ics`, which covers a folded description, an event
with no description, a description with no location, an unmapped building, and a nested `VALARM`.
Regenerate nothing by hand: if you need another case, add an event to the fixture.

Outbound `fetch` is stubbed globally by `test/fetch-stub.ts`. The worker shares the test isolate, so
the stub covers calls made through `SELF` too.

## Compatibility date

`wrangler.jsonc` is held at the newest date the vitest pool's bundled workerd supports, so tests
exercise the same semantics as production. Bump it and `@cloudflare/vitest-pool-workers` together.

## Deployment

`.github/workflows/deploy.yml` deploys on push to `main`, gated on typecheck and tests.

The hostname was previously served by a container on Portainer behind a cloudflared tunnel. That is
gone; do not reintroduce a Dockerfile or a Compose file.
