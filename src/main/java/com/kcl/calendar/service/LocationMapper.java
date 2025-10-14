package com.kcl.calendar.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Maps abbreviated KCL building codes to full location names.
 * Returns only the building address for proper geocoding in calendar apps.
 */
public class LocationMapper {

    private final Map<String, String> locationMappings;

    public LocationMapper() {
        this.locationMappings = loadLocationMappings();
    }

    /**
     * Maps an abbreviated location to its full building address.
     * Returns only the base address (building name and postcode) for proper geocoding.
     *
     * @param abbreviatedLocation the abbreviated location string
     * @return the full building address, or original if no mapping found
     */
    public String mapLocation(String abbreviatedLocation) {
        if (abbreviatedLocation == null) {
            return null;
        }

        if (abbreviatedLocation.isEmpty()) {
            return abbreviatedLocation;
        }

        // Try to find a matching building code in the location string
        String upperLocation = abbreviatedLocation.toUpperCase();

        for (Map.Entry<String, String> entry : locationMappings.entrySet()) {
            String code = entry.getKey();
            String fullAddress = entry.getValue();

            // Check if the location contains this building code
            if (containsBuildingCode(upperLocation, code)) {
                // Return just the base address without room numbers
                return fullAddress;
            }
        }

        // No mapping found, return original
        return abbreviatedLocation;
    }

    /**
     * Checks if the location string contains the building code.
     * Handles variations like "KINGS BLDG", "KINGS_BLDG", "KIN", etc.
     */
    private boolean containsBuildingCode(String upperLocation, String code) {
        // Replace underscores with spaces or remove them for matching
        String codePattern = code.replace("_", "[_ ]?");

        // Create pattern that matches the code as a whole word or prefix
        Pattern pattern = Pattern.compile("\\b" + codePattern + "\\b");
        Matcher matcher = pattern.matcher(upperLocation);

        return matcher.find();
    }

    /**
     * Loads location mappings from the properties file.
     */
    private Map<String, String> loadLocationMappings() {
        Map<String, String> mappings = new HashMap<>();
        Properties properties = new Properties();

        try (InputStream input = getClass().getClassLoader()
                .getResourceAsStream("location-mappings.properties")) {

            if (input == null) {
                System.err.println("Unable to find location-mappings.properties");
                return mappings;
            }

            properties.load(input);

            for (String key : properties.stringPropertyNames()) {
                mappings.put(key, properties.getProperty(key));
            }

        } catch (IOException e) {
            System.err.println("Error loading location mappings: " + e.getMessage());
        }

        return mappings;
    }
}
