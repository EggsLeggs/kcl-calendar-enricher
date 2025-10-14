package com.kcl.calendar.service;

import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Fetches ICS calendar files from URLs.
 */
public class CalendarFetcher {

    private final HttpClient httpClient;
    private final CalendarBuilder calendarBuilder;

    /**
     * Initialises a CalendarFetcher with a configured HTTP client and a calendar parser.
     *
     * <p>The HTTP client is configured with a 30-second connection timeout and normal
     * redirect behaviour. A new CalendarBuilder is created for parsing ICS data.
     */
    public CalendarFetcher() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        this.calendarBuilder = new CalendarBuilder();
    }

    /**
     * Ensure the provided URL is a KCL Scientia calendar URL that meets strict domain and path constraints.
     *
     * The URL must use the HTTPS scheme, have host scientia-eu-v4-api-d4-02.azurewebsites.net,
     * have a non-null path that begins with "/api/ical/" or "//api/ical/", and end with "/timetable.ics".
     *
     * @param url the URL to validate
     * @throws IllegalArgumentException if the URL is null, malformed, or does not meet the required scheme, host or path constraints
     */
    private void validateUrl(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            String path = uri.getPath();
            String scheme = uri.getScheme();

            if (!"https".equalsIgnoreCase(scheme)) {
                throw new IllegalArgumentException("Only HTTPS URLs are allowed");
            }

            if (host == null || !"scientia-eu-v4-api-d4-02.azurewebsites.net".equals(host)) {
                throw new IllegalArgumentException("Only KCL Scientia calendar URLs (scientia-eu-v4-api-d4-02.azurewebsites.net) are allowed");
            }

            if (path == null) {
                throw new IllegalArgumentException("URL path cannot be null");
            }

            // Accept both /api/ical/ and //api/ical/ (KCL uses double slash)
            if (!path.startsWith("/api/ical/") && !path.startsWith("//api/ical/")) {
                throw new IllegalArgumentException("URL path must start with /api/ical/ or //api/ical/");
            }

            if (!path.endsWith("/timetable.ics")) {
                throw new IllegalArgumentException("URL must end with /timetable.ics");
            }

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid URL format: " + e.getMessage(), e);
        }
    }

    /**
     * Fetches and parses an ICS calendar from the given URL after validating it belongs to the allowed KCL Scientia domain.
     *
     * @param url the HTTPS URL of the ICS calendar hosted on scientia-eu-v4-api-d4-02.azurewebsites.net (path must begin with `/api/ical/` and end with `/timetable.ics`)
     * @return the parsed Calendar
     * @throws IOException if there is a network error, a non-200 HTTP response, or the request is interrupted
     * @throws ParserException if there is an error parsing the calendar data
     * @throws IllegalArgumentException if the URL is null, empty, uses an unsupported scheme/host/path, or otherwise fails validation
     */
    public Calendar fetchCalendar(String url) throws IOException, ParserException {
        if (url == null || url.isEmpty()) {
            throw new IllegalArgumentException("URL cannot be null or empty");
        }

        validateUrl(url);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .GET()
                    .build();

            HttpResponse<InputStream> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() != 200) {
                throw new IOException("Failed to fetch calendar: HTTP " + response.statusCode());
            }

            try (InputStream inputStream = response.body()) {
                return calendarBuilder.build(inputStream);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Request was interrupted", e);
        }
    }
}