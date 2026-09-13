/**
 * Rewrites the LOCATION property of each VEVENT from the location named in its DESCRIPTION.
 *
 * This works on the raw text rather than through an ICS object model, which is deliberate. Only
 * LOCATION changes; every other line - VTIMEZONE blocks, DTSTART, RRULE, and anything else KCL
 * emits - is copied through byte for byte, including its original folding. A parse-and-reserialise
 * would rewrite the whole document to its own conventions and drift from the source for no gain.
 *
 * The one normalisation applied is line endings: output is always CRLF, as RFC 5545 requires.
 */

import { mapLocation } from './locations.ts'
import { parse } from './parser.ts'

const CRLF = '\r\n'

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
  let depth = 0
  let descriptionIndex = -1
  let locationIndex = -1

  for (const [index, line] of body.entries()) {
    const property = splitProperty(line.content)
    if (property === null) {
      continue
    }

    if (property.name === 'BEGIN') {
      depth++
    } else if (property.name === 'END') {
      depth--
    } else if (depth === 0) {
      if (property.name === 'DESCRIPTION' && descriptionIndex === -1) {
        descriptionIndex = index
      } else if (property.name === 'LOCATION' && locationIndex === -1) {
        locationIndex = index
      }
    }
  }

  if (descriptionIndex === -1) {
    return body
  }

  const description = splitProperty(body[descriptionIndex]?.content ?? '')
  if (description === null) {
    return body
  }

  const parsed = parse(unescapeText(description.value))
  if (parsed.location === null) {
    return body
  }

  // An unmapped location still overwrites LOCATION with the raw text from the DESCRIPTION, which
  // is what the Java service did - mapLocation returns its input when no building code matches.
  const address = mapLocation(parsed.location) ?? parsed.location
  const replacement = logicalLine(`LOCATION:${escapeText(address)}`)

  const result = [...body]
  if (locationIndex === -1) {
    result.push(replacement)
  } else {
    result[locationIndex] = replacement
  }

  return result
}

/**
 * Enriches every VEVENT in an ICS document.
 *
 * @throws ParseError if the body is not an ICS calendar.
 */
export function enrichCalendar(ics: string): string {
  // A byte order mark would otherwise attach itself to the first property name.
  const lines = parseLines(ics.startsWith('\uFEFF') ? ics.slice(1) : ics)

  const out: LogicalLine[] = []
  let event: LogicalLine[] | null = null
  let sawCalendar = false

  for (const line of lines) {
    const marker = line.content.trim().toUpperCase()

    if (marker === 'BEGIN:VCALENDAR') {
      sawCalendar = true
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
