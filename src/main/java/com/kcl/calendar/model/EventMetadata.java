package com.kcl.calendar.model;

import java.util.Optional;

/**
 * Represents parsed metadata from a KCL calendar event description.
 */
public class EventMetadata {
    private final String eventType;
    private final String description;
    private final String location;
    private final String date;
    private final String staff;

    public EventMetadata(String eventType, String description, String location, String date, String staff) {
        this.eventType = eventType;
        this.description = description;
        this.location = location;
        this.date = date;
        this.staff = staff;
    }

    public Optional<String> getEventType() {
        return Optional.ofNullable(eventType);
    }

    public Optional<String> getDescription() {
        return Optional.ofNullable(description);
    }

    public Optional<String> getLocation() {
        return Optional.ofNullable(location);
    }

    public Optional<String> getDate() {
        return Optional.ofNullable(date);
    }

    public Optional<String> getStaff() {
        return Optional.ofNullable(staff);
    }

    @Override
    public String toString() {
        return "EventMetadata{" +
                "eventType='" + eventType + '\'' +
                ", description='" + description + '\'' +
                ", location='" + location + '\'' +
                ", date='" + date + '\'' +
                ", staff='" + staff + '\'' +
                '}';
    }
}
