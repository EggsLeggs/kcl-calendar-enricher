package com.kcl.calendar.service;

import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.Property;
import net.fortuna.ical4j.model.component.CalendarComponent;
import net.fortuna.ical4j.model.component.VEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test suite for CalendarEnricher using TDD approach.
 */
class CalendarEnricherTest {

    private CalendarEnricher enricher;
    private String testCalendarUrl;

    @BeforeEach
    void setUp() {
        enricher = new CalendarEnricher();
        // Get calendar URL from environment variable
        testCalendarUrl = System.getenv("TEST_CALENDAR_URL");
        if (testCalendarUrl == null || testCalendarUrl.isEmpty()) {
            throw new IllegalStateException("TEST_CALENDAR_URL environment variable must be set to run tests");
        }
    }

    @Test
    void testEnrichCalendarFromUrl() throws IOException, ParserException {
        // Given
        String url = testCalendarUrl;

        // When
        Calendar enrichedCalendar = enricher.enrichCalendar(url);

        // Then
        assertNotNull(enrichedCalendar, "Enriched calendar should not be null");
        assertNotNull(enrichedCalendar.getComponents(), "Calendar should have components");
        assertTrue(enrichedCalendar.getComponents().size() > 0, "Calendar should have events");

        // Check that events are enriched
        Optional<CalendarComponent> firstEvent = enrichedCalendar.getComponents().stream()
                .filter(c -> c instanceof VEvent)
                .findFirst();

        assertTrue(firstEvent.isPresent(), "Should have at least one event");
    }

    @Test
    void testEnrichEventWithLocation() throws IOException, ParserException {
        // Given
        String url = testCalendarUrl;

        // When
        Calendar enrichedCalendar = enricher.enrichCalendar(url);

        // Then
        boolean foundEnrichedLocation = false;
        for (CalendarComponent component : enrichedCalendar.getComponents()) {
            if (component instanceof VEvent) {
                VEvent event = (VEvent) component;
                Property location = event.getProperty("LOCATION");

                // Check if any event has been enriched with a full location (ending in UK)
                if (location != null && location.getValue().contains(", UK")) {
                    foundEnrichedLocation = true;
                    break;
                }
            }
        }

        assertTrue(foundEnrichedLocation,
                "At least one event should have an enriched location ending with ', UK'");
    }

    @Test
    void testEnrichCalendarPreservesOriginalEvents() throws IOException, ParserException {
        // Given
        String url = testCalendarUrl;

        // Fetch original calendar
        CalendarFetcher fetcher = new CalendarFetcher();
        Calendar originalCalendar = fetcher.fetchCalendar(url);
        int originalEventCount = (int) originalCalendar.getComponents().stream()
                .filter(c -> c instanceof VEvent)
                .count();

        // When
        Calendar enrichedCalendar = enricher.enrichCalendar(url);

        // Then - should have the same number of events
        int enrichedEventCount = (int) enrichedCalendar.getComponents().stream()
                .filter(c -> c instanceof VEvent)
                .count();

        assertEquals(originalEventCount, enrichedEventCount,
                "Enriched calendar should have the same number of events as original");
    }

    @Test
    void testEnrichCalendarIsVersion2() throws IOException, ParserException {
        // Given
        String url = testCalendarUrl;

        // When
        Calendar enrichedCalendar = enricher.enrichCalendar(url);

        // Then
        assertNotNull(enrichedCalendar.getProperty("VERSION"));
        assertEquals("2.0", enrichedCalendar.getProperty("VERSION").getValue());
    }

    @Test
    void testEnrichCalendarFromNullUrl() {
        // When & Then
        assertThrows(IllegalArgumentException.class, () -> {
            enricher.enrichCalendar(null);
        });
    }

    @Test
    void testEnrichCalendarFromEmptyUrl() {
        // When & Then
        assertThrows(IllegalArgumentException.class, () -> {
            enricher.enrichCalendar("");
        });
    }
}
