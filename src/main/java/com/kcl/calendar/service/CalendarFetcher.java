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

    public CalendarFetcher() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        this.calendarBuilder = new CalendarBuilder();
    }

    /**
     * Fetches and parses a calendar from the given URL.
     *
     * @param url the URL of the ICS calendar
     * @return the parsed Calendar object
     * @throws IOException if there's an error fetching the calendar
     * @throws ParserException if there's an error parsing the calendar
     * @throws IllegalArgumentException if the URL is null or empty
     */
    public Calendar fetchCalendar(String url) throws IOException, ParserException {
        if (url == null || url.isEmpty()) {
            throw new IllegalArgumentException("URL cannot be null or empty");
        }

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
