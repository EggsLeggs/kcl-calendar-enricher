/**
 * Maps abbreviated KCL building codes to a street address and a coordinate, so calendar apps can
 * both geocode the location and drop a pin without geocoding at all.
 *
 * Ported from the Java `LocationMapper` and `location-mappings.properties`. Two deliberate changes:
 * the patterns are built once here rather than recompiled on every lookup, and the order is the
 * order below rather than Java's `HashMap` iteration order, which was unspecified. Every code that
 * can match the same string as another resolves to the same place, so the ordering was never
 * observable, but it is now at least deterministic.
 */

export interface Place {
  /** A full street address, for `LOCATION`. */
  address: string
  /**
   * Latitude then longitude in decimal degrees, WGS-84, which is the order and datum RFC 5545
   * `GEO` requires. These are building entrances rather than centroids, and they are approximate:
   * good enough for a map pin sitting next to the full address, not a survey.
   */
  geo: readonly [latitude: number, longitude: number]
}

const KINGS_BUILDING: Place = {
  address: '33-41 Surrey St, London, WC2R 2ND, England',
  geo: [51.5115, -0.116],
}
const WATERLOO: Place = {
  address: 'Franklin-Wilkins Building, Stamford St, London SE1 9NH, UK',
  geo: [51.5058, -0.1103],
}
const BUSH_HOUSE: Place = {
  address: '30 Bush House, Aldwych, London, WC2B 4BG, England',
  geo: [51.5128, -0.1173],
}
const IET_TURING: Place = {
  address: '2 Savoy Pl, London, WC2R 0BL, England',
  geo: [51.5093, -0.1207],
}
const SOMERSET_HOUSE: Place = {
  address: 'Somerset House, Strand, London WC2R 1LA, UK',
  geo: [51.511, -0.117],
}
const MAUGHAN: Place = {
  address: 'Maughan Library, Chancery Lane, London WC2A 1LR, UK',
  geo: [51.5155, -0.1105],
}
const GUYS: Place = {
  address: "Guy's Campus, Great Maze Pond, London SE1 1UL, UK",
  geo: [51.5035, -0.0875],
}
const ST_THOMAS: Place = {
  address: "St Thomas' Campus, Westminster Bridge Rd, London SE1 7EH, UK",
  geo: [51.4988, -0.1187],
}
const DENMARK_HILL: Place = {
  address: 'Denmark Hill Campus, Denmark Hill, London SE5 9RS, UK',
  geo: [51.4685, -0.0935],
}

/** Building code to place. First match wins, so list the more specific codes first. */
const MAPPINGS: ReadonlyArray<readonly [code: string, place: Place]> = [
  // King's Building. KINGS_BDLG is a deliberate alias for a typo seen in real feeds.
  ['KINGS_BLDG', KINGS_BUILDING],
  ['KINGS_BDLG', KINGS_BUILDING],
  ['KIN', KINGS_BUILDING],

  // Strand Building, the same Strand Campus address as the King's Building.
  ['STRAND_BLDG', KINGS_BUILDING],
  ['STR', KINGS_BUILDING],

  // Waterloo Campus
  ['WATERLOO', WATERLOO],
  ['FWB', WATERLOO],

  // Bush House
  ['BUSH_HOUSE', BUSH_HOUSE],
  ['BSH', BUSH_HOUSE],

  // IET Turing
  ['IET_TURING', IET_TURING],
  ['IET', IET_TURING],
  ['TURING', IET_TURING],

  // Somerset House
  ['SOMERSET_HOUSE', SOMERSET_HOUSE],
  ['SOM', SOMERSET_HOUSE],

  // Maughan Library
  ['MAUGHAN', MAUGHAN],
  ['MAU', MAUGHAN],

  // Guy's Campus
  ['GUYS', GUYS],
  ['GUY', GUYS],

  // St Thomas' Campus
  ['ST_THOMAS', ST_THOMAS],
  ['STH', ST_THOMAS],

  // Denmark Hill Campus
  ['DENMARK_HILL', DENMARK_HILL],
  ['DEN', DENMARK_HILL],
]

/**
 * An underscore in a code matches an underscore, a space, or nothing, so `KINGS_BLDG` matches
 * "KINGS BLDG", "KINGS_BLDG" and "KINGSBLDG". Codes are drawn from `[A-Z_]` only, so none of them
 * needs regex escaping.
 */
const MATCHERS: ReadonlyArray<readonly [pattern: RegExp, place: Place]> = MAPPINGS.map(
  ([code, place]) => [new RegExp(`\\b${code.replaceAll('_', '[_ ]?')}\\b`), place] as const,
)

/** The place an abbreviated location names, or null when no building code matches it. */
export function findPlace(abbreviated: string | null): Place | null {
  if (abbreviated === null || abbreviated === '') {
    return null
  }

  const upper = abbreviated.toUpperCase()
  for (const [pattern, place] of MATCHERS) {
    if (pattern.test(upper)) {
      return place
    }
  }

  return null
}
