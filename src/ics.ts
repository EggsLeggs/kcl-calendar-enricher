/**
 * Fills in the properties KCL leaves out, from the structured text it puts in each event's
 * DESCRIPTION.
 *
 * This works on the raw text rather than through an ICS object model, which is deliberate. Only the
 * properties in MANAGED are written; every other line - VTIMEZONE blocks, DTSTART, RRULE, and
 * anything else KCL emits - is copied through byte for byte, including its original folding. A
 * parse-and-reserialise would rewrite the whole document to its own conventions and drift from the
 * source for no gain.
 *
 * The one normalisation applied is line endings: output is always CRLF, as RFC 5545 requires.
 */

import { findPlace } from './locations.ts'
import { parse } from './parser.ts'

const CRLF = '\r\n'

/**
 * The event properties this module writes. LOCATION is overwritten because a bare room code is the
 * bug this service exists to fix. The rest are only ever added, never replaced: KCL does not emit
 * them today, and if it ever starts, a value it derived itself beats one we inferred from prose.
 */
export const MANAGED = ['LOCATION', 'GEO', 'CATEGORIES', 'CONTACT'] as const

/**
 * How often a client should re-read the feed. REFRESH-INTERVAL is the RFC 7986 property;
 * X-PUBLISHED-TTL is the older spelling that Outlook and Apple Calendar actually read, so both go
 * out. PT5M matches the max-age on the response, so a client that honours either sees a room change
 * about as soon as the cache does rather than at whatever daily poll it would otherwise pick.
 *
 * They are one fact in two spellings, so they are added together or not at all. Adding our PT5M
 * beside a PT1H of KCL's would be two answers to the same question.
 */
export const REFRESH = [
  'REFRESH-INTERVAL;VALUE=DURATION:PT5M',
  'X-PUBLISHED-TTL:PT5M',
] as const

/** RFC 5545 says content lines SHOULD be folded at 75 octets, excluding the CRLF. */
const FOLD_LIMIT = 75

const encoder = new TextEncoder()

/** Thrown when the body does not look like an ICS calendar at all. */
export class ParseError extends Error {
  override readonly name = 'ParseError'
}

/**
 * One logical content line, together with the physical lines it was folded across in the source.
 * Keeping the original lets untouched properties round trip exactly.
 */
interface LogicalLine {
  /** The physical source lines, in order. Empty for lines this module created. */
  raw: string[]
  /** The unfolded content. */
  content: string
}

/**
 * Splits into logical lines, undoing RFC 5545 folding: a physical line beginning with a space or
 * tab continues the previous one, minus that single leading character.
 */
function parseLines(text: string): LogicalLine[] {
  const lines: LogicalLine[] = []

  for (const physical of text.split(/\r\n|\n|\r/)) {
    const previous = lines[lines.length - 1]
    if (previous !== undefined && (physical.startsWith(' ') || physical.startsWith('\t'))) {
      previous.raw.push(physical)
      previous.content += physical.slice(1)
    } else {
      lines.push({ raw: [physical], content: physical })
    }
  }

  return lines
}

/**
 * Folds a content line at 75 octets. Counting is by UTF-8 byte, and iteration is by code point, so
 * a multi-byte character is never split across the fold. Continuation lines carry a leading space,
 * which counts towards their own 75.
 */
function fold(content: string): string[] {
  if (encoder.encode(content).length <= FOLD_LIMIT) {
    return [content]
  }

  const physical: string[] = []
  let current = ''
  let bytes = 0
  let limit = FOLD_LIMIT

  for (const character of content) {
    const size = encoder.encode(character).length
    if (bytes + size > limit) {
      physical.push(current)
      current = ''
      bytes = 0
      // Every line after the first spends one of its octets on the leading space.
      limit = FOLD_LIMIT - 1
    }
    current += character
    bytes += size
  }
  physical.push(current)

  return physical.map((line, index) => (index === 0 ? line : ` ${line}`))
}

function logicalLine(content: string): LogicalLine {
  return { raw: fold(content), content }
}

/** Decodes an escaped TEXT value: `\n` and `\N` to newline, and `\\`, `\;`, `\,` to themselves. */
export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_match, character: string) =>
    character === 'n' || character === 'N' ? '\n' : character,
  )
}

/** Encodes a TEXT value. Backslash first, or the escapes added below would be escaped again. */
export function escapeText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
}

/**
 * Splits a content line into its property name and value. The value starts after the first colon
 * that is not inside a quoted parameter, so `DESCRIPTION;ALTREP="http://x:1/y":text` works.
 */
function splitProperty(content: string): { name: string; value: string } | null {
  const nameMatch = /^([A-Za-z0-9-]+)/.exec(content)
  if (nameMatch === null) {
    return null
  }

  let quoted = false
  for (let index = 0; index < content.length; index++) {
    const character = content[index]
    if (character === '"') {
      quoted = !quoted
    } else if (character === ':' && !quoted) {
      return { name: (nameMatch[1] ?? '').toUpperCase(), value: content.slice(index + 1) }
    }
  }

  return null
}

/**
 * Rewrites one VEVENT's body, which excludes its BEGIN and END lines.
 *
 * Only the event's own properties are considered: a nested component such as a VALARM carries its
 * own DESCRIPTION, and picking that one up would read the reminder text instead of the timetable
 * entry.
 */
function enrichEvent(body: LogicalLine[]): LogicalLine[] {
  const { own, insertAt } = ownProperties(body)

  const descriptionIndex = own.get('DESCRIPTION')
  if (descriptionIndex === undefined) {
    return body
  }

  const description = splitProperty(body[descriptionIndex]?.content ?? '')
  if (description === null) {
    return body
  }

  const parsed = parse(unescapeText(description.value))
  const place = findPlace(parsed.location)
  const result = [...body]
  const added: LogicalLine[] = []

  /** Adds a property, or replaces the event's existing one when `overwrite` is set. */
  const set = (content: string, overwrite = false): void => {
    const existing = own.get(splitProperty(content)?.name ?? '')
    if (existing === undefined) {
      added.push(logicalLine(content))
    } else if (overwrite) {
      result[existing] = logicalLine(content)
    }
  }

  if (parsed.location !== null) {
    // An unmapped location still overwrites LOCATION with the raw text from the DESCRIPTION, which
    // is what the Java service did. A bare room code is worse than an unexpanded building name.
    set(`LOCATION:${escapeText(place?.address ?? parsed.location)}`, true)
  }

  if (place !== null) {
    // GEO is two semicolon-separated floats, latitude first, and is not a TEXT value, so it is not
    // escaped. It saves the client a geocoding round trip and gives it a pin for travel time.
    set(`GEO:${place.geo[0]};${place.geo[1]}`)
  }

  if (parsed.eventType !== null) {
    // "Lecture", "Practical", "Seminar". CATEGORIES is a comma-separated list, and escapeText
    // escapes the comma, so a type containing one stays a single category.
    set(`CATEGORIES:${escapeText(parsed.eventType)}`)
  }

  if (parsed.staff !== null) {
    // KCL writes staff as "Surname, Forename, Surname, Forename", with no way to tell a name
    // boundary from a list boundary, so it goes out as one CONTACT rather than a guessed split.
    // ATTENDEE is the wrong property regardless: it needs a CAL-ADDRESS, and it would make a
    // read-only timetable look like an invitation the client should RSVP to.
    set(`CONTACT:${escapeText(parsed.staff)}`)
  }

  // RFC 5545 spells a VEVENT as its properties followed by its alarms, so anything added has to go
  // in ahead of the first nested component rather than on the end.
  result.splice(insertAt, 0, ...added)

  return result
}

/**
 * Indexes an event's own properties by name, first occurrence winning, and finds where a new
 * property belongs: just before the first nested component, or at the end when there is none.
 *
 * Nested components are skipped: a VALARM carries its own DESCRIPTION, and picking that one up
 * would read the reminder text instead of the timetable entry.
 */
function ownProperties(body: LogicalLine[]): { own: Map<string, number>; insertAt: number } {
  const own = new Map<string, number>()
  let depth = 0
  let insertAt = body.length

  for (const [index, line] of body.entries()) {
    const property = splitProperty(line.content)
    if (property === null) {
      continue
    }

    if (property.name === 'BEGIN') {
      if (depth === 0 && insertAt === body.length) {
        insertAt = index
      }
      depth++
    } else if (property.name === 'END') {
      depth--
    } else if (depth === 0 && !own.has(property.name)) {
      own.set(property.name, index)
    }
  }

  return { own, insertAt }
}

/**
 * The names of the properties sitting directly in VCALENDAR, so the refresh hints are only added
 * when KCL has not sent its own. Properties inside VEVENT and VTIMEZONE do not count.
 */
function calendarProperties(lines: LogicalLine[]): Set<string> {
  const names = new Set<string>()
  let depth = 0

  for (const line of lines) {
    const property = splitProperty(line.content)
    if (property === null) {
      continue
    }

    if (property.name === 'BEGIN') {
      depth++
    } else if (property.name === 'END') {
      depth--
    } else if (depth === 1) {
      names.add(property.name)
    }
  }

  return names
}

/**
 * Enriches every VEVENT in an ICS document.
 *
 * @throws ParseError if the body is not an ICS calendar.
 */
export function enrichCalendar(ics: string): string {
  // A byte order mark would otherwise attach itself to the first property name.
  const lines = parseLines(ics.startsWith('\uFEFF') ? ics.slice(1) : ics)

  const calendar = calendarProperties(lines)

  const out: LogicalLine[] = []
  let event: LogicalLine[] | null = null
  let sawCalendar = false

  for (const line of lines) {
    const marker = line.content.trim().toUpperCase()

    if (marker === 'BEGIN:VCALENDAR' && !sawCalendar) {
      sawCalendar = true
      out.push(line)
      if (REFRESH.every((property) => !calendar.has(splitProperty(property)?.name ?? ''))) {
        out.push(...REFRESH.map(logicalLine))
      }
      continue
    }

    if (event === null) {
      out.push(line)
      if (marker === 'BEGIN:VEVENT') {
        event = []
      }
      continue
    }

    if (marker === 'END:VEVENT') {
      out.push(...enrichEvent(event), line)
      event = null
      continue
    }

    event.push(line)
  }

  if (!sawCalendar) {
    throw new ParseError('Body is not an ICS calendar: no BEGIN:VCALENDAR')
  }

  // An unterminated VEVENT is malformed, but dropping its lines would be worse than passing them on.
  if (event !== null) {
    out.push(...event)
  }

  return out.flatMap((line) => line.raw).join(CRLF)
}
