package com.kcl.calendar.parser;

import com.kcl.calendar.model.EventMetadata;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses event body text from KCL calendar descriptions.
 * Extracts structured metadata from the description field.
 */
public class EventBodyParser {

    private static final Pattern EVENT_TYPE_PATTERN = Pattern.compile("Event type:\\s*(.+?)(?:\\n|$)");
    private static final Pattern DESCRIPTION_PATTERN = Pattern.compile("Description:\\s*(.+?)(?:\\n|$)");
    private static final Pattern LOCATION_PATTERN = Pattern.compile("Location:\\s*(.+?)(?:\\n|$)");
    private static final Pattern DATE_PATTERN = Pattern.compile("Date:\\s*(.+?)(?:\\n|$)");
    private static final Pattern STAFF_PATTERN = Pattern.compile("Staff:\\s*(.+?)(?:\\n|$)");

    /**
     * Parses a calendar event description and extracts structured metadata.
     *
     * @param description the raw event description text
     * @return EventMetadata containing parsed fields
     */
    public EventMetadata parse(String description) {
        if (description == null || description.isEmpty()) {
            return new EventMetadata(null, null, null, null, null);
        }

        String eventType = extractField(description, EVENT_TYPE_PATTERN);
        String descriptionText = extractField(description, DESCRIPTION_PATTERN);
        String location = extractField(description, LOCATION_PATTERN);
        String date = extractField(description, DATE_PATTERN);
        String staff = extractField(description, STAFF_PATTERN);

        return new EventMetadata(eventType, descriptionText, location, date, staff);
    }

    /**
     * Extracts a field value using a regex pattern.
     *
     * @param text    the text to search
     * @param pattern the regex pattern to match
     * @return the extracted field value, or null if not found
     */
    private String extractField(String text, Pattern pattern) {
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            String value = matcher.group(1).trim();
            // Remove trailing tabs and other whitespace characters
            value = value.replaceAll("\\s+$", "");
            return value.isEmpty() ? null : value;
        }
        return null;
    }
}
