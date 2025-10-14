package com.kcl.calendar.parser;

import com.kcl.calendar.model.EventMetadata;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test suite for EventBodyParser using TDD approach.
 */
class EventBodyParserTest {

    private EventBodyParser parser;

    @BeforeEach
    void setUp() {
        parser = new EventBodyParser();
    }

    @Test
    void testParseFullEventWithAllFields() {
        // Given
        String description = "Event type: Lecture\n" +
                "Description: AGENTS AND MULTI-AGENT SYSTEMS\n" +
                "Location: KINGS BLDG KIN 625 (Anatomy Lecture Theatre)\n" +
                "Date: Tuesday, 14 October 2025\n" +
                "Staff: Sarkadi, Stefan, Black, Elizabeth\n\n";

        // When
        EventMetadata metadata = parser.parse(description);

        // Then
        assertNotNull(metadata);
        assertTrue(metadata.getEventType().isPresent());
        assertEquals("Lecture", metadata.getEventType().get());

        assertTrue(metadata.getDescription().isPresent());
        assertEquals("AGENTS AND MULTI-AGENT SYSTEMS", metadata.getDescription().get());

        assertTrue(metadata.getLocation().isPresent());
        assertEquals("KINGS BLDG KIN 625 (Anatomy Lecture Theatre)", metadata.getLocation().get());

        assertTrue(metadata.getDate().isPresent());
        assertEquals("Tuesday, 14 October 2025", metadata.getDate().get());

        assertTrue(metadata.getStaff().isPresent());
        assertEquals("Sarkadi, Stefan, Black, Elizabeth", metadata.getStaff().get());
    }

    @Test
    void testParseEventWithoutLocation() {
        // Given
        String description = "Event type: Online Live Lecture\n" +
                "Date: Tuesday, 20 January 2026\n" +
                "Staff: Wells, Toby\n\n";

        // When
        EventMetadata metadata = parser.parse(description);

        // Then
        assertNotNull(metadata);
        assertTrue(metadata.getEventType().isPresent());
        assertEquals("Online Live Lecture", metadata.getEventType().get());

        assertFalse(metadata.getLocation().isPresent());
        assertFalse(metadata.getDescription().isPresent());

        assertTrue(metadata.getDate().isPresent());
        assertEquals("Tuesday, 20 January 2026", metadata.getDate().get());

        assertTrue(metadata.getStaff().isPresent());
        assertEquals("Wells, Toby", metadata.getStaff().get());
    }

    @Test
    void testParseEventWithOnlyEventType() {
        // Given
        String description = "Event type: Revision\n\n";

        // When
        EventMetadata metadata = parser.parse(description);

        // Then
        assertNotNull(metadata);
        assertTrue(metadata.getEventType().isPresent());
        assertEquals("Revision", metadata.getEventType().get());

        assertFalse(metadata.getDescription().isPresent());
        assertFalse(metadata.getLocation().isPresent());
        assertFalse(metadata.getDate().isPresent());
        assertFalse(metadata.getStaff().isPresent());
    }

    @Test
    void testParseEventWithMultipleStaffMembers() {
        // Given
        String description = "Event type: Lecture\n" +
                "Description: Distributed ledgers and crypto-currencies\n" +
                "Location: KINGS BLDG KIN 427\n" +
                "Date: Friday, 23 January 2026\n" +
                "Staff: McBurney, Peter\n\n";

        // When
        EventMetadata metadata = parser.parse(description);

        // Then
        assertNotNull(metadata);
        assertTrue(metadata.getStaff().isPresent());
        assertEquals("McBurney, Peter", metadata.getStaff().get());
    }

    @Test
    void testParseEventWithTabsAndExtraWhitespace() {
        // Given - simulating the actual ICS format with tabs and extra spaces
        String description = "Event type: Lecture\n" +
                "Description: MSc Individual Project - Avoiding Plagiarism\n" +
                "Location: STRAND BLDG S-2.18\n" +
                "Date: Tuesday, 21 October 2025\n" +
                "Staff: Seymour, William\t\n\n";

        // When
        EventMetadata metadata = parser.parse(description);

        // Then
        assertNotNull(metadata);
        assertTrue(metadata.getStaff().isPresent());
        assertEquals("Seymour, William", metadata.getStaff().get().trim());
    }

    @Test
    void testParseEmptyString() {
        // Given
        String description = "";

        // When
        EventMetadata metadata = parser.parse(description);

        // Then
        assertNotNull(metadata);
        assertFalse(metadata.getEventType().isPresent());
        assertFalse(metadata.getDescription().isPresent());
        assertFalse(metadata.getLocation().isPresent());
        assertFalse(metadata.getDate().isPresent());
        assertFalse(metadata.getStaff().isPresent());
    }

    @Test
    void testParseNullString() {
        // When
        EventMetadata metadata = parser.parse(null);

        // Then
        assertNotNull(metadata);
        assertFalse(metadata.getEventType().isPresent());
    }

    @Test
    void testParseEventWithDifferentLocation() {
        // Given
        String description = "Event type: Lecture\n" +
                "Location: WATERLOO FWB B5\n" +
                "Date: Thursday, 19 February 2026\n" +
                "Staff: Tibbetts, Neil\n\n";

        // When
        EventMetadata metadata = parser.parse(description);

        // Then
        assertNotNull(metadata);
        assertTrue(metadata.getLocation().isPresent());
        assertEquals("WATERLOO FWB B5", metadata.getLocation().get());
    }
}
