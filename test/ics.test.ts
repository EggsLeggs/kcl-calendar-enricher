import { describe, expect, it } from 'vitest'

import { MANAGED, ParseError, REFRESH, enrichCalendar, escapeText, unescapeText } from '../src/ics.ts'
import fixture from './fixtures/timetable.ics?raw'

const KINGS = '33-41 Surrey St, London, WC2R 2ND, England'
const WATERLOO = 'Franklin-Wilkins Building, Stamford St, London SE1 9NH, UK'
const BUSH_HOUSE = '30 Bush House, Aldwych, London, WC2B 4BG, England'

/** Undoes RFC 5545 folding, so tests can assert on logical lines. */
function unfold(ics: string): string[] {
  const lines: string[] = []
  for (const physical of ics.split('\r\n')) {
    if (lines.length > 0 && (physical.startsWith(' ') || physical.startsWith('\t'))) {
      lines[lines.length - 1] += physical.slice(1)
    } else {
      lines.push(physical)
    }
  }
  return lines
}

/** The logical lines of the VEVENT whose UID matches, excluding BEGIN and END. */
function event(ics: string, uid: string): string[] {
  const lines = unfold(ics)
  const starts = lines.flatMap((line, index) => (line === 'BEGIN:VEVENT' ? [index] : []))
  for (const start of starts) {
    const end = lines.indexOf('END:VEVENT', start)
    const body = lines.slice(start + 1, end)
    if (body.includes(`UID:${uid}`)) {
      return body
    }
  }
  throw new Error(`no VEVENT with UID:${uid}`)
}

const locationOf = (ics: string, uid: string): string | undefined =>
  event(ics, uid)
    .find((line) => line.startsWith('LOCATION:'))
    ?.slice('LOCATION:'.length)

describe('enrichCalendar', () => {
  const enriched = enrichCalendar(fixture)

  it('changes nothing outside the properties it manages', () => {
    const written = [...MANAGED, ...REFRESH.map((property) => property.split(/[;:]/)[0])]
    const ours = (line: string): boolean =>
      written.some((name) => line.startsWith(`${name}:`) || line.startsWith(`${name};`))

    expect(unfold(enriched).filter((line) => !ours(line))).toEqual(
      unfold(fixture).filter((line) => !ours(line)),
    )
  })

  it('reads a location out of a folded DESCRIPTION and maps it', () => {
    expect(locationOf(enriched, 'event-1@scientia.example')).toBe(escapeText(KINGS))
  })

  it('replaces an existing LOCATION in place rather than moving it', () => {
    const body = event(enriched, 'event-1@scientia.example')
    const location = body.findIndex((line) => line.startsWith('LOCATION:'))
    const description = body.findIndex((line) => line.startsWith('DESCRIPTION:'))

    expect(location).toBeGreaterThan(-1)
    expect(location).toBeLessThan(description)
    expect(body.filter((line) => line.startsWith('LOCATION:'))).toHaveLength(1)
  })

  it('inserts a LOCATION when the event has none', () => {
    expect(locationOf(enriched, 'event-2@scientia.example')).toBe(escapeText(WATERLOO))
  })

  it('leaves an event with no DESCRIPTION completely untouched', () => {
    expect(event(enriched, 'event-3@scientia.example')).toEqual(
      event(fixture, 'event-3@scientia.example'),
    )
    expect(locationOf(enriched, 'event-3@scientia.example')).toBe('TBC')
  })

  it('keeps the original LOCATION when the DESCRIPTION names no location', () => {
    expect(locationOf(enriched, 'event-4@scientia.example')).toBe('See email')
  })

  it('writes the raw location through when no building code matches', () => {
    // The Java service did the same: mapLocation returns its input when nothing matches, and the
    // result still overwrote LOCATION.
    expect(locationOf(enriched, 'event-5@scientia.example')).toBe('MYSTERY BLDG 3.14')
  })

  it('ignores a DESCRIPTION belonging to a nested VALARM', () => {
    expect(locationOf(enriched, 'event-6@scientia.example')).toBe(escapeText(BUSH_HOUSE))
  })

  it('escapes commas in the emitted LOCATION', () => {
    const raw = enriched.split('\r\n').find((line) => line.startsWith('LOCATION:33-41'))
    expect(raw).toContain('33-41 Surrey St\\, London\\,')
  })

  it('adds GEO for a building it knows', () => {
    expect(event(enriched, 'event-1@scientia.example')).toContain('GEO:51.5115;-0.116')
  })

  it('adds no GEO when no building code matches', () => {
    const body = event(enriched, 'event-5@scientia.example')
    expect(body.some((line) => line.startsWith('GEO:'))).toBe(false)
  })

  it('adds CATEGORIES from the event type', () => {
    expect(event(enriched, 'event-1@scientia.example')).toContain('CATEGORIES:Lecture')
    expect(event(enriched, 'event-6@scientia.example')).toContain('CATEGORIES:Seminar')
  })

  it('adds CONTACT from the staff line, as one value', () => {
    const contacts = event(enriched, 'event-1@scientia.example').filter((line) =>
      line.startsWith('CONTACT:'),
    )

    // "Sarkadi, Stefan, Black, Elizabeth" is two people, but nothing in the feed says where one
    // name ends, so it stays a single escaped value rather than a guessed split.
    expect(contacts).toEqual([`CONTACT:${escapeText('Sarkadi, Stefan, Black, Elizabeth')}`])
  })

  it('still adds CATEGORIES and CONTACT when the DESCRIPTION names no location', () => {
    const body = event(enriched, 'event-4@scientia.example')

    expect(body).toContain('CATEGORIES:Drop-in')
    expect(body).toContain(`CONTACT:${escapeText('Black, Elizabeth')}`)
    expect(body).toContain('LOCATION:See email')
  })

  it('adds nothing to an event with no DESCRIPTION', () => {
    expect(event(enriched, 'event-3@scientia.example')).toEqual(
      event(fixture, 'event-3@scientia.example'),
    )
  })

  it('reads the event type from the event, not from a nested VALARM', () => {
    const body = event(enriched, 'event-6@scientia.example')

    // The VALARM's DESCRIPTION names WATERLOO. The event's names Bush House.
    expect(body).toContain('GEO:51.5128;-0.1173')
    expect(body.filter((line) => line.startsWith('CATEGORIES:'))).toEqual(['CATEGORIES:Seminar'])
  })

  it('puts added properties before a nested VALARM, not after it', () => {
    // RFC 5545 spells a VEVENT as its properties followed by its alarms. Appending on the end put
    // GEO and friends after END:VALARM, which is out of grammar.
    const body = event(enriched, 'event-6@scientia.example')

    for (const name of ['LOCATION:', 'GEO:', 'CATEGORIES:', 'CONTACT:']) {
      expect(body.findIndex((line) => line.startsWith(name))).toBeLessThan(
        body.indexOf('BEGIN:VALARM'),
      )
    }
  })

  it('advertises a five minute refresh interval on the calendar', () => {
    const lines = unfold(enriched)

    expect(lines).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT5M')
    expect(lines).toContain('X-PUBLISHED-TTL:PT5M')
    // Directly after BEGIN:VCALENDAR, and only once.
    expect(lines.indexOf('REFRESH-INTERVAL;VALUE=DURATION:PT5M')).toBe(
      lines.indexOf('BEGIN:VCALENDAR') + 1,
    )
    expect(lines.filter((line) => line.startsWith('X-PUBLISHED-TTL:'))).toHaveLength(1)
  })

  it('leaves a refresh interval KCL sent alone', () => {
    const withOwn = enrichCalendar(
      'BEGIN:VCALENDAR\r\nREFRESH-INTERVAL;VALUE=DURATION:PT1H\r\nEND:VCALENDAR\r\n',
    )

    expect(withOwn).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H')
    expect(withOwn).not.toContain('PT5M')
  })

  it('folds every physical line to 75 octets or fewer', () => {
    const encoder = new TextEncoder()
    for (const line of enriched.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('preserves the trailing CRLF', () => {
    expect(enriched.endsWith('\r\n')).toBe(true)
  })

  it('normalises LF input to CRLF output', () => {
    const lf = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n'
    expect(enrichCalendar(lf)).toBe(
      `BEGIN:VCALENDAR\r\n${REFRESH.join('\r\n')}\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n`,
    )
  })

  it('strips a byte order mark', () => {
    expect(enrichCalendar('\uFEFFBEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')).toBe(
      `BEGIN:VCALENDAR\r\n${REFRESH.join('\r\n')}\r\nEND:VCALENDAR\r\n`,
    )
  })

  it('rejects a body that is not a calendar', () => {
    expect(() => enrichCalendar('<html>not a calendar</html>')).toThrow(ParseError)
  })

  it('passes an unterminated VEVENT through rather than dropping it', () => {
    const truncated = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\n'
    expect(enrichCalendar(truncated)).toContain('UID:x')
  })
})

describe('TEXT escaping', () => {
  it('round trips the characters RFC 5545 escapes', () => {
    const value = 'a, b; c\\ d\ne'
    expect(unescapeText(escapeText(value))).toBe(value)
  })

  it('decodes both \\n and \\N as a newline', () => {
    expect(unescapeText('one\\ntwo\\Nthree')).toBe('one\ntwo\nthree')
  })

  it('escapes a backslash before the escapes it introduces', () => {
    expect(escapeText('C:\\path, here')).toBe('C:\\\\path\\, here')
  })
})
