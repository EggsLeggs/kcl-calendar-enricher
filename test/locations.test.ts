import { describe, expect, it } from 'vitest'

import { mapLocation } from '../src/locations.ts'

const KINGS = '33-41 Surrey St, London, WC2R 2ND, England'
const WATERLOO = 'Franklin-Wilkins Building, Stamford St, London SE1 9NH, UK'

describe('mapLocation', () => {
  it("maps King's Building", () => {
    expect(mapLocation('KINGS BLDG KIN 625 (Anatomy Lecture Theatre)')).toBe(KINGS)
  })

  it('maps Strand Building', () => {
    expect(mapLocation('STRAND BLDG S-2.18')).toBe(KINGS)
  })

  it('maps Waterloo', () => {
    expect(mapLocation('WATERLOO FWB B5')).toBe(WATERLOO)
  })

  it('maps a bare KIN room code', () => {
    expect(mapLocation('KIN 427')).toBe(KINGS)
  })

  it('returns an unknown location unchanged', () => {
    expect(mapLocation('UNKNOWN BLDG UNK 123')).toBe('UNKNOWN BLDG UNK 123')
  })

  it('returns null for null', () => {
    expect(mapLocation(null)).toBeNull()
  })

  it('returns an empty string for an empty string', () => {
    expect(mapLocation('')).toBe('')
  })

  it('matches case insensitively', () => {
    expect(mapLocation('kings bldg kin 625')).toBe(KINGS)
  })

  it('drops the room number', () => {
    const mapped = mapLocation('KINGS BLDG KIN 625')
    expect(mapped).toBe(KINGS)
    expect(mapped).not.toContain('625')
  })

  it('drops trailing room detail', () => {
    const mapped = mapLocation('STRAND BLDG S-2.18 (Seminar Room)')
    expect(mapped).toBe(KINGS)
    expect(mapped).not.toContain('S-2.18')
    expect(mapped).not.toContain('Seminar Room')
  })

  it('accepts underscored, spaced and joined forms of a code', () => {
    expect(mapLocation('KINGS_BLDG 625')).toBe(KINGS)
    expect(mapLocation('KINGSBLDG 625')).toBe(KINGS)
    expect(mapLocation('KINGS BLDG 625')).toBe(KINGS)
  })

  it('tolerates the KINGS_BDLG typo seen in real feeds', () => {
    expect(mapLocation('KINGS BDLG 625')).toBe(KINGS)
  })

  it('requires a whole-word match', () => {
    // KIN must not match inside KINDER, and STR must not match inside STRING.
    expect(mapLocation('KINDER ROOM 1')).toBe('KINDER ROOM 1')
    expect(mapLocation('STRING LAB')).toBe('STRING LAB')
  })

  it('resolves a string matching two codes deterministically', () => {
    // KINGS_BLDG and KIN both match. Both carry the same address, so order is not observable,
    // but a Map iterates in insertion order where the Java HashMap did not.
    expect(mapLocation('KINGS BLDG KIN 625')).toBe(KINGS)
    expect(mapLocation('KINGS BLDG KIN 625')).toBe(mapLocation('KINGS BLDG KIN 625'))
  })
})
