/**
 * Parses the structured text KCL puts in an event's DESCRIPTION:
 *
 *     Event type: Lecture
 *     Description: AGENTS AND MULTI-AGENT SYSTEMS
 *     Location: KINGS BLDG KIN 625 (Anatomy Lecture Theatre)
 *     Date: Tuesday, 14 October 2025
 *     Staff: Sarkadi, Stefan, Black, Elizabeth
 *
 * Ported verbatim from the Java `EventBodyParser`. The patterns carry no flags on purpose: Java's
 * default `$` means end of input and so does JavaScript's without `m`, and neither treats `.` as
 * matching a newline. Adding `m` or `s` here would change which text each field captures.
 *
 * Note this expects the *decoded* DESCRIPTION value - unfolded, with `\n` turned back into real
 * newlines. See `unescapeText` in ics.ts.
 */

export interface EventMetadata {
  eventType: string | null
  description: string | null
  location: string | null
  date: string | null
  staff: string | null
}

const EVENT_TYPE_PATTERN = /Event type:\s*(.+?)(?:\n|$)/
const DESCRIPTION_PATTERN = /Description:\s*(.+?)(?:\n|$)/
const LOCATION_PATTERN = /Location:\s*(.+?)(?:\n|$)/
const DATE_PATTERN = /Date:\s*(.+?)(?:\n|$)/
const STAFF_PATTERN = /Staff:\s*(.+?)(?:\n|$)/

const EMPTY: EventMetadata = {
  eventType: null,
  description: null,
  location: null,
  date: null,
  staff: null,
}

/** Extracts the first occurrence of a field, treating a blank value as absent. */
function extractField(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text)
  if (match === null) {
    return null
  }

  // Java trimmed only characters at or below U+0020; JavaScript also strips things like NBSP. KCL
  // has not been seen to emit either, and the wider trim is the more forgiving of the two.
  const value = (match[1] ?? '').trim()
  return value === '' ? null : value
}

export function parse(description: string | null | undefined): EventMetadata {
  if (description === null || description === undefined || description === '') {
    return { ...EMPTY }
  }

  return {
    eventType: extractField(description, EVENT_TYPE_PATTERN),
    description: extractField(description, DESCRIPTION_PATTERN),
    location: extractField(description, LOCATION_PATTERN),
    date: extractField(description, DATE_PATTERN),
    staff: extractField(description, STAFF_PATTERN),
  }
}
