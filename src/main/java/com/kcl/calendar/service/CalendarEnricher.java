package com.kcl.calendar.service;

import com.kcl.calendar.model.EventMetadata;
import com.kcl.calendar.parser.EventBodyParser;
import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.Property;
import net.fortuna.ical4j.model.component.CalendarComponent;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.Location;

import java.io.IOException;

/**
 * Main service for enriching KCL calendar feeds.
 * Fetches calendars, parses event metadata, maps locations, and generates enriched calendars.
 */
public class CalendarEnricher {

    private final CalendarFetcher fetcher;
    private final EventBodyParser parser;
    private final LocationMapper locationMapper;

    public CalendarEnricher() {
        this.fetcher = new CalendarFetcher();
        this.parser = new EventBodyParser();
        this.locationMapper = new LocationMapper();
    }

    /**
     * Fetches a calendar from the given URL and enriches it with proper location metadata.
     *
     * @param url the URL of the ICS calendar to enrich
     * @return the enriched Calendar object
     * @throws IOException if there's an error fetching the calendar
     * @throws ParserException if there's an error parsing the calendar
     * @throws IllegalArgumentException if the URL is null or empty
     */
    public Calendar enrichCalendar(String url) throws IOException, ParserException {
        if (url == null || url.isEmpty()) {
            throw new IllegalArgumentException("URL cannot be null or empty");
        }

        // Fetch the original calendar
        Calendar calendar = fetcher.fetchCalendar(url);

        // Enrich each event
        for (CalendarComponent component : calendar.getComponents()) {
            if (component instanceof VEvent) {
                enrichEvent((VEvent) component);
            }
        }

        return calendar;
    }

    /**
     * Enriches a single event by parsing its description and updating its location.
     */
    private void enrichEvent(VEvent event) {
        // Get the description
        Property descriptionProp = event.getProperty("DESCRIPTION");
        if (descriptionProp == null) {
            return;
        }

        String description = descriptionProp.getValue();

        // Parse the description to extract metadata
        EventMetadata metadata = parser.parse(description);

        // If we found a location in the description, map it to the full name
        metadata.getLocation().ifPresent(abbreviatedLocation -> {
            String fullLocation = locationMapper.mapLocation(abbreviatedLocation);

            // Update or add the LOCATION property
            Property existingLocation = event.getProperty("LOCATION");
            if (existingLocation != null) {
                event.getProperties().remove(existingLocation);
            }

            event.getProperties().add(new Location(fullLocation));
        });

        // Optionally, we could also add other metadata as custom properties
        // For now, we're focusing on location enrichment
    }

    /**
     * Converts an enriched calendar back to ICS format string.
     *
     * @param calendar the calendar to convert
     * @return the ICS format string
     */
    public String toIcsString(Calendar calendar) {
        return calendar.toString();
    }
}
