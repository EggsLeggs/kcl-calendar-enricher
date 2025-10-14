package com.kcl.calendar.service;

import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test suite for CalendarFetcher using TDD approach.
 */
class CalendarFetcherTest {

    private CalendarFetcher fetcher;
    private String testCalendarUrl;

    @BeforeEach
    void setUp() {
        fetcher = new CalendarFetcher();
        // Get calendar URL from environment variable
        testCalendarUrl = System.getenv("TEST_CALENDAR_URL");
        if (testCalendarUrl == null || testCalendarUrl.isEmpty()) {
            throw new IllegalStateException("TEST_CALENDAR_URL environment variable must be set to run tests");
        }
    }

    @Test
    void testFetchCalendarFromValidUrl() throws IOException, ParserException {
        // Given - using calendar URL from environment variable
        String url = testCalendarUrl;

        // When
        Calendar calendar = fetcher.fetchCalendar(url);

        // Then
        assertNotNull(calendar, "Calendar should not be null");
        assertNotNull(calendar.getComponents(), "Calendar should have components");
        assertTrue(calendar.getComponents().size() > 0, "Calendar should have at least one event");
    }

    @Test
    void testFetchCalendarFromInvalidUrl() {
        // Given
        String url = "https://invalid-url-that-does-not-exist.com/calendar.ics";

        // When & Then - can throw either IOException or ParserException
        assertThrows(Exception.class, () -> {
            fetcher.fetchCalendar(url);
        });
    }

    @Test
    void testFetchCalendarFromNullUrl() {
        // When & Then
        assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar(null);
        });
    }

    @Test
    void testFetchCalendarFromEmptyUrl() {
        // When & Then
        assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar("");
        });
    }

    @Test
    void testFetchCalendarReturnsVersion2() throws IOException, ParserException {
        // Given
        String url = testCalendarUrl;

        // When
        Calendar calendar = fetcher.fetchCalendar(url);

        // Then
        assertNotNull(calendar.getProperty("VERSION"));
        assertEquals("2.0", calendar.getProperty("VERSION").getValue());
    }
}
