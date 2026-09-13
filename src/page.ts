/**
 * The page at `/`.
 *
 * Several people use this service, each with their own Scientia link, and until now the only way to
 * get a subscribe URL was to hand-assemble a query string. This does that for them and applies the
 * same validation the Worker does, so a wrong URL is caught here rather than as a 400 inside a
 * calendar app where nobody sees it.
 *
 * String.raw keeps the backslashes in the client-side regex intact. No dependencies, no build step.
 */
export const PAGE = String.raw`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KCL Calendar Enricher</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfbfa;
    --fg: #1c1b19;
    --muted: #66625c;
    --line: #dedad3;
    --card: #ffffff;
    --accent: #8a4b2a;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #171614;
      --fg: #ece9e4;
      --muted: #9b968e;
      --line: #333029;
      --card: #201e1b;
      --accent: #e09b74;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 48px 20px 64px;
    background: var(--bg);
    color: var(--fg);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .5rem; letter-spacing: -0.01em; }
  p { margin: 0 0 1rem; }
  .muted { color: var(--muted); font-size: .9rem; }
  label { display: block; font-weight: 600; margin-bottom: .35rem; font-size: .9rem; }
  input {
    width: 100%;
    padding: .6rem .7rem;
    font: inherit;
    font-size: .95rem;
    color: var(--fg);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 7px;
  }
  input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  button, a.button {
    font: inherit;
    font-weight: 600;
    padding: .55rem 1rem;
    border-radius: 7px;
    border: 1px solid transparent;
    background: var(--accent);
    color: var(--bg);
    cursor: pointer;
  }
  a.button { display: inline-block; line-height: 1.6; text-decoration: none; }
  .secondary { background: var(--card); color: var(--fg); border-color: var(--line); }
  .row { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: .75rem; }
  .row > * { flex: 0 0 auto; }
  #out { margin-top: 1.75rem; padding-top: 1.5rem; border-top: 1px solid var(--line); }
  #link { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem; }
  #error { color: var(--accent); font-weight: 600; margin-top: .75rem; }
  details { margin-top: 1.5rem; font-size: .9rem; color: var(--muted); }
  summary { cursor: pointer; font-weight: 600; }
  footer { margin-top: 3rem; font-size: .8rem; color: var(--muted); }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <h1>KCL Calendar Enricher</h1>
  <p>
    KCL's timetable feed leaves <code>LOCATION</code> as a bare room code, so calendar apps cannot
    map it. Paste your timetable link below and you will get a subscribe link that fills in the full
    street address for each event.
  </p>

  <form id="form" novalidate>
    <label for="src">Your KCL timetable URL</label>
    <input id="src" name="src" type="url" spellcheck="false" autocomplete="off"
           placeholder="https://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/.../timetable.ics">
    <div class="row"><button type="submit">Build my link</button></div>
  </form>

  <p id="error" hidden></p>

  <div id="out" hidden>
    <label for="link">Subscribe with this</label>
    <input id="link" readonly>
    <div class="row">
      <button type="button" id="copy" class="secondary">Copy</button>
      <a id="webcal" href="#" class="button secondary">Open in calendar app</a>
    </div>
    <p class="muted" style="margin-top:.9rem">
      Add it as a subscribed or internet calendar, not as an import, so it keeps updating. Changes to
      your timetable show up within about five minutes.
    </p>
  </div>

  <details>
    <summary>Where do I find my timetable URL?</summary>
    <p style="margin-top:.6rem">
      In KCL's timetable system, look for the subscribe or export option on your timetable. It gives
      you an <code>.ics</code> link on <code>scientia-eu-v4-api-...azurewebsites.net</code> ending in
      <code>/timetable.ics</code>. That link is personal to you and is the only thing protecting your
      timetable, so treat it like a password.
    </p>
  </details>

  <footer>Not affiliated with King's College London.</footer>
</main>

<script>
  var HOST = /^scientia-eu-v4-api-d\d{1,2}-\d{1,2}\.azurewebsites\.net$/;
  var form = document.getElementById('form');
  var src = document.getElementById('src');
  var out = document.getElementById('out');
  var link = document.getElementById('link');
  var webcal = document.getElementById('webcal');
  var error = document.getElementById('error');
  var copy = document.getElementById('copy');

  function fail(message) {
    error.textContent = message;
    error.hidden = false;
    out.hidden = true;
  }

  // Mirrors validateUrl in src/upstream.ts. Keep the two in step.
  function check(raw) {
    var url;
    try { url = new URL(raw); } catch (e) { return 'That does not look like a URL.'; }
    if (url.protocol !== 'https:') return 'The link must start with https://';
    if (!HOST.test(url.hostname.toLowerCase())) return 'That is not a KCL Scientia timetable link.';
    if (url.pathname.indexOf('/api/ical/') !== 0 && url.pathname.indexOf('//api/ical/') !== 0) {
      return 'That Scientia link is not a timetable feed.';
    }
    if (!/\/timetable\.ics$/.test(url.pathname)) return 'The link must end with /timetable.ics';
    return null;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var raw = src.value.trim();
    if (raw === '') return fail('Paste your timetable URL first.');

    var problem = check(raw);
    if (problem !== null) return fail(problem);

    error.hidden = true;
    var subscribe = location.origin + '/enrich?url=' + encodeURIComponent(raw);
    link.value = subscribe;
    webcal.href = subscribe.replace(/^https?:/, 'webcal:');
    out.hidden = false;
    // Keep the field scrolled to the start so the link is recognisable. Selecting it here would
    // park the caret at the end and show nothing but the tail of the encoded URL.
    link.scrollLeft = 0;
    copy.focus();
  });

  copy.addEventListener('click', function () {
    link.select();
    var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy'; }, 1500); };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link.value).then(done, function () {});
    } else if (document.execCommand('copy')) {
      done();
    }
  });
</script>
</body>
</html>
`
