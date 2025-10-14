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

        // When & Then - should reject due to invalid domain
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar(url);
        });
        assertTrue(exception.getMessage().contains("scientia-eu-v4-api-d4-02.azurewebsites.net"));
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

    @Test
    void testRejectsNonHttpsUrl() {
        // Given
        String url = "http://scientia-eu-v4-api-d4-02.azurewebsites.net/api/ical/test/timetable.ics";

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar(url);
        });
        assertTrue(exception.getMessage().contains("HTTPS"));
    }

    @Test
    void testRejectsNonAzureWebsitesDomain() {
        // Given
        String url = "https://malicious-site.com/api/ical/test/timetable.ics";

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar(url);
        });
        assertTrue(exception.getMessage().contains("scientia-eu-v4-api-d4-02.azurewebsites.net"));
    }

    @Test
    void testRejectsWrongAzureDomain() {
        // Given - different azure domain that's not the exact KCL Scientia domain
        String url = "https://other-scientia.azurewebsites.net/api/ical/test/timetable.ics";

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar(url);
        });
        assertTrue(exception.getMessage().contains("scientia-eu-v4-api-d4-02.azurewebsites.net"));
    }

    @Test
    void testRejectsNonIcsFile() {
        // Given
        String url = "https://scientia-eu-v4-api-d4-02.azurewebsites.net/api/ical/test/timetable.txt";

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar(url);
        });
        assertTrue(exception.getMessage().contains("/timetable.ics"));
    }

    @Test
    void testRejectsWrongIcsFilename() {
        // Given - ends with .ics but not /timetable.ics
        String url = "https://scientia-eu-v4-api-d4-02.azurewebsites.net/api/ical/test/calendar.ics";

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar(url);
        });
        assertTrue(exception.getMessage().contains("/timetable.ics"));
    }

    @Test
    void testRejectsWrongPathPrefix() {
        // Given - correct domain and filename but wrong path
        String url = "https://scientia-eu-v4-api-d4-02.azurewebsites.net/other/path/test/timetable.ics";

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            fetcher.fetchCalendar(url);
        });
        assertTrue(exception.getMessage().contains("/api/ical/"));
    }

    @Test
    void testAcceptsValidKclCalendarUrl() throws IOException, ParserException {
        // Given - URL from environment variable should be a valid KCL calendar URL
        String url = testCalendarUrl;

        // When & Then - should not throw validation exception
        assertDoesNotThrow(() -> {
            fetcher.fetchCalendar(url);
        });
    }
}
