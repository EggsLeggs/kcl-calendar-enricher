import { describe, expect, it } from 'vitest'

import { parse } from '../src/parser.ts'

describe('parse', () => {
  it('reads every field from a full event', () => {
    const metadata = parse(
      'Event type: Lecture\n' +
        'Description: AGENTS AND MULTI-AGENT SYSTEMS\n' +
        'Location: KINGS BLDG KIN 625 (Anatomy Lecture Theatre)\n' +
        'Date: Tuesday, 14 October 2025\n' +
        'Staff: Sarkadi, Stefan, Black, Elizabeth\n\n',
    )

    expect(metadata).toEqual({
      eventType: 'Lecture',
      description: 'AGENTS AND MULTI-AGENT SYSTEMS',
      location: 'KINGS BLDG KIN 625 (Anatomy Lecture Theatre)',
      date: 'Tuesday, 14 October 2025',
      staff: 'Sarkadi, Stefan, Black, Elizabeth',
    })
  })

  it('leaves absent fields null', () => {
    const metadata = parse(
      'Event type: Online Live Lecture\nDate: Tuesday, 20 January 2026\nStaff: Wells, Toby\n\n',
    )

    expect(metadata.eventType).toBe('Online Live Lecture')
    expect(metadata.location).toBeNull()
    expect(metadata.description).toBeNull()
    expect(metadata.date).toBe('Tuesday, 20 January 2026')
    expect(metadata.staff).toBe('Wells, Toby')
  })

  it('handles an event with only an event type', () => {
    expect(parse('Event type: Revision\n\n')).toEqual({
      eventType: 'Revision',
      description: null,
      location: null,
      date: null,
      staff: null,
    })
  })

  it('keeps the commas in a staff list', () => {
    const metadata = parse(
      'Event type: Lecture\n' +
        'Description: Distributed ledgers and crypto-currencies\n' +
        'Location: KINGS BLDG KIN 427\n' +
        'Date: Friday, 23 January 2026\n' +
        'Staff: McBurney, Peter\n\n',
    )

    expect(metadata.staff).toBe('McBurney, Peter')
  })

  it('trims trailing tabs and whitespace', () => {
    const metadata = parse(
      'Event type: Lecture\n' +
        'Description: MSc Individual Project - Avoiding Plagiarism\n' +
        'Location: STRAND BLDG S-2.18\n' +
        'Date: Tuesday, 21 October 2025\n' +
        'Staff: Seymour, William\t\n\n',
    )

    expect(metadata.staff).toBe('Seymour, William')
  })

  it('returns all nulls for an empty string', () => {
    expect(parse('')).toEqual({
      eventType: null,
      description: null,
      location: null,
      date: null,
      staff: null,
    })
  })

  it('returns all nulls for null or undefined', () => {
    expect(parse(null).eventType).toBeNull()
    expect(parse(undefined).eventType).toBeNull()
  })

  it('reads a location from an event with no description line', () => {
    const metadata = parse(
      'Event type: Lecture\n' +
        'Location: WATERLOO FWB B5\n' +
        'Date: Thursday, 19 February 2026\n' +
        'Staff: Tibbetts, Neil\n\n',
    )

    expect(metadata.location).toBe('WATERLOO FWB B5')
  })

  it('takes only the first occurrence of a field', () => {
    expect(parse('Location: KIN 625\nLocation: FWB B5\n').location).toBe('KIN 625')
  })

  it('matches field labels case sensitively, as the Java parser did', () => {
    expect(parse('location: KIN 625\n').location).toBeNull()
  })
})
