/**
 * Maps abbreviated KCL building codes to full street addresses, so calendar apps can geocode them.
 *
 * Ported from the Java `LocationMapper` and `location-mappings.properties`. Two deliberate changes:
 * the patterns are built once here rather than recompiled on every lookup, and the order is the
 * order below rather than Java's `HashMap` iteration order, which was unspecified. Every code that
 * can match the same string as another resolves to the same address, so the ordering was never
 * observable, but it is now at least deterministic.
 */

/** Building code to address. First match wins, so list the more specific codes first. */
const MAPPINGS: ReadonlyArray<readonly [code: string, address: string]> = [
  // King's Building. KINGS_BDLG is a deliberate alias for a typo seen in real feeds.
  ['KINGS_BLDG', '33-41 Surrey St, London, WC2R 2ND, England'],
  ['KINGS_BDLG', '33-41 Surrey St, London, WC2R 2ND, England'],
  ['KIN', '33-41 Surrey St, London, WC2R 2ND, England'],

  // Strand Building
  ['STRAND_BLDG', '33-41 Surrey St, London, WC2R 2ND, England'],
  ['STR', '33-41 Surrey St, London, WC2R 2ND, England'],

  // Waterloo Campus
  ['WATERLOO', 'Franklin-Wilkins Building, Stamford St, London SE1 9NH, UK'],
  ['FWB', 'Franklin-Wilkins Building, Stamford St, London SE1 9NH, UK'],

  // Bush House
  ['BUSH_HOUSE', '30 Bush House, Aldwych, London, WC2B 4BG, England'],
  ['BSH', '30 Bush House, Aldwych, London, WC2B 4BG, England'],

  // IET Turing
  ['IET_TURING', '2 Savoy Pl, London, WC2R 0BL, England'],
  ['IET', '2 Savoy Pl, London, WC2R 0BL, England'],
  ['TURING', '2 Savoy Pl, London, WC2R 0BL, England'],

  // Somerset House
  ['SOMERSET_HOUSE', 'Somerset House, Strand, London WC2R 1LA, UK'],
  ['SOM', 'Somerset House, Strand, London WC2R 1LA, UK'],

  // Maughan Library
  ['MAUGHAN', 'Maughan Library, Chancery Lane, London WC2A 1LR, UK'],
  ['MAU', 'Maughan Library, Chancery Lane, London WC2A 1LR, UK'],

  // Guy's Campus
  ['GUYS', "Guy's Campus, Great Maze Pond, London SE1 1UL, UK"],
  ['GUY', "Guy's Campus, Great Maze Pond, London SE1 1UL, UK"],

  // St Thomas' Campus
  ['ST_THOMAS', "St Thomas' Campus, Westminster Bridge Rd, London SE1 7EH, UK"],
  ['STH', "St Thomas' Campus, Westminster Bridge Rd, London SE1 7EH, UK"],

  // Denmark Hill Campus
  ['DENMARK_HILL', 'Denmark Hill Campus, Denmark Hill, London SE5 9RS, UK'],
  ['DEN', 'Denmark Hill Campus, Denmark Hill, London SE5 9RS, UK'],
]

/**
 * An underscore in a code matches an underscore, a space, or nothing, so `KINGS_BLDG` matches
 * "KINGS BLDG", "KINGS_BLDG" and "KINGSBLDG". Codes are drawn from `[A-Z_]` only, so none of them
 * needs regex escaping.
 */
const MATCHERS: ReadonlyArray<readonly [pattern: RegExp, address: string]> = MAPPINGS.map(
  ([code, address]) => [new RegExp(`\\b${code.replaceAll('_', '[_ ]?')}\\b`), address] as const,
)

/**
 * Expands an abbreviated location to a full address, or returns it unchanged when no code matches.
 * Null in, null out; empty string in, empty string out.
 */
export function mapLocation(abbreviated: string | null): string | null {
  if (abbreviated === null) {
    return null
  }
  if (abbreviated === '') {
    return abbreviated
  }

  const upper = abbreviated.toUpperCase()
  for (const [pattern, address] of MATCHERS) {
    if (pattern.test(upper)) {
      return address
    }
  }

  return abbreviated
}
