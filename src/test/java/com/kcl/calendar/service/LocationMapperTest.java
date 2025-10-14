package com.kcl.calendar.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test suite for LocationMapper using TDD approach.
 */
class LocationMapperTest {

    private LocationMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new LocationMapper();
    }

    @Test
    void testMapKingsBuildingLocation() {
        // Given
        String abbreviatedLocation = "KINGS BLDG KIN 625 (Anatomy Lecture Theatre)";

        // When
        String fullLocation = mapper.mapLocation(abbreviatedLocation);

        // Then
        assertNotNull(fullLocation);
        assertTrue(fullLocation.contains("33-41 Surrey St"));
        assertTrue(fullLocation.contains("London"));
        assertTrue(fullLocation.contains("WC2R 2ND"));
        assertTrue(fullLocation.contains("England"));
    }

    @Test
    void testMapStrandBuildingLocation() {
        // Given
        String abbreviatedLocation = "STRAND BLDG S-2.18";

        // When
        String fullLocation = mapper.mapLocation(abbreviatedLocation);

        // Then
        assertNotNull(fullLocation);
        assertTrue(fullLocation.contains("33-41 Surrey St"));
        assertTrue(fullLocation.contains("London"));
        assertTrue(fullLocation.contains("WC2R 2ND"));
        assertTrue(fullLocation.contains("England"));
    }

    @Test
    void testMapWaterlooLocation() {
        // Given
        String abbreviatedLocation = "WATERLOO FWB B5";

        // When
        String fullLocation = mapper.mapLocation(abbreviatedLocation);

        // Then
        assertNotNull(fullLocation);
        assertTrue(fullLocation.contains("Franklin-Wilkins Building"));
        assertTrue(fullLocation.contains("Stamford St"));
        assertTrue(fullLocation.contains("SE1 9NH"));
        assertTrue(fullLocation.contains("UK"));
    }

    @Test
    void testMapSimpleKINLocation() {
        // Given
        String abbreviatedLocation = "KIN 427";

        // When
        String fullLocation = mapper.mapLocation(abbreviatedLocation);

        // Then
        assertNotNull(fullLocation);
        assertTrue(fullLocation.contains("33-41 Surrey St"));
        assertTrue(fullLocation.contains("London"));
        assertTrue(fullLocation.contains("WC2R 2ND"));
        assertTrue(fullLocation.contains("England"));
    }

    @Test
    void testMapUnknownLocation() {
        // Given
        String abbreviatedLocation = "UNKNOWN BLDG UNK 123";

        // When
        String fullLocation = mapper.mapLocation(abbreviatedLocation);

        // Then - should return original location
        assertEquals(abbreviatedLocation, fullLocation);
    }

    @Test
    void testMapNullLocation() {
        // When
        String fullLocation = mapper.mapLocation(null);

        // Then
        assertNull(fullLocation);
    }

    @Test
    void testMapEmptyLocation() {
        // When
        String fullLocation = mapper.mapLocation("");

        // Then
        assertEquals("", fullLocation);
    }

    @Test
    void testCaseInsensitiveMapping() {
        // Given
        String abbreviatedLocation = "kings bldg kin 625";

        // When
        String fullLocation = mapper.mapLocation(abbreviatedLocation);

        // Then
        assertNotNull(fullLocation);
        assertTrue(fullLocation.contains("33-41 Surrey St"));
    }

    @Test
    void testDoesNotIncludeRoomNumber() {
        // Given
        String abbreviatedLocation = "KINGS BLDG KIN 625";

        // When
        String fullLocation = mapper.mapLocation(abbreviatedLocation);

        // Then
        assertNotNull(fullLocation);
        assertTrue(fullLocation.contains("33-41 Surrey St"));
        assertTrue(fullLocation.contains("London"));
        assertTrue(fullLocation.contains("WC2R 2ND"));
        assertTrue(fullLocation.contains("England"));
        assertFalse(fullLocation.contains("625"), "Should NOT include room number in location");
    }

    @Test
    void testMapsWithoutAdditionalDetails() {
        // Given
        String abbreviatedLocation = "STRAND BLDG S-2.18 (Seminar Room)";

        // When
        String fullLocation = mapper.mapLocation(abbreviatedLocation);

        // Then
        assertTrue(fullLocation.contains("33-41 Surrey St"));
        assertTrue(fullLocation.contains("London"));
        assertTrue(fullLocation.contains("WC2R 2ND"));
        assertTrue(fullLocation.contains("England"));
        assertFalse(fullLocation.contains("S-2.18"), "Should NOT include room number");
        assertFalse(fullLocation.contains("Seminar Room"), "Should NOT include additional details");
    }
}
