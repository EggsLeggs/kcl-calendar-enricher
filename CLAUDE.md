# KCL Calendar Enricher - Claude Project Specification

## Project Overview

The KCL Calendar Enricher is a Java application that enriches King's College London (KCL) ICS calendar feeds with proper location metadata. It fetches calendar feeds from KCL's Scientia system, parses event descriptions to extract location information, maps abbreviated building codes to full addresses, and serves enriched calendar feeds via HTTP.

## Technology Stack

- **Language**: Java 17+
- **Build Tool**: Maven 3.9+
- **Testing Framework**: JUnit 5
- **ICS Parsing**: iCal4j 3.2.14
- **HTTP Server**: Javalin 5.6.3
- **HTTP Client**: Apache HttpClient 5

## Project Structure

```
src/
├── main/
│   ├── java/com/kcl/calendar/
│   │   ├── CalendarEnricherApplication.java  # Main application and HTTP server
│   │   ├── model/
│   │   │   └── EventMetadata.java            # Model for parsed event metadata
│   │   ├── parser/
│   │   │   └── EventBodyParser.java          # Parses event descriptions
│   │   └── service/
│   │       ├── CalendarEnricher.java         # Main enrichment service
│   │       ├── CalendarFetcher.java          # Fetches ICS from URLs
│   │       └── LocationMapper.java           # Maps building codes to full names
│   └── resources/
│       └── location-mappings.properties      # Building code mappings
└── test/
    └── java/com/kcl/calendar/
        ├── parser/
        │   └── EventBodyParserTest.java
        └── service/
            ├── CalendarEnricherTest.java
            ├── CalendarFetcherTest.java
            └── LocationMapperTest.java
```

## Key Components

### 1. EventBodyParser
- **Location**: `src/main/java/com/kcl/calendar/parser/EventBodyParser.java`
- **Purpose**: Parses structured text from event DESCRIPTION fields
- **Input**: Event description text like:
  ```
  Event type: Lecture
  Description: AGENTS AND MULTI-AGENT SYSTEMS
  Location: KINGS BLDG KIN 625 (Anatomy Lecture Theatre)
  Date: Tuesday, 14 October 2025
  Staff: Sarkadi, Stefan, Black, Elizabeth
  ```
- **Output**: `EventMetadata` object with parsed fields

### 2. LocationMapper
- **Location**: `src/main/java/com/kcl/calendar/service/LocationMapper.java`
- **Purpose**: Maps abbreviated building codes to full addresses
- **Configuration**: `src/main/resources/location-mappings.properties`
- **Examples**:
  - `KINGS BLDG` → `King's Building - King's College London, Strand Campus, London WC2R 2LS`
  - `WATERLOO` → `Franklin-Wilkins Building - King's College London, Waterloo Campus, London SE1 9NH`

### 3. CalendarFetcher
- **Location**: `src/main/java/com/kcl/calendar/service/CalendarFetcher.java`
- **Purpose**: Fetches ICS calendar files from URLs
- **Features**:
  - HTTP timeout handling (30 seconds)
  - Redirect following
  - Error handling for network and parsing issues

### 4. CalendarEnricher
- **Location**: `src/main/java/com/kcl/calendar/service/CalendarEnricher.java`
- **Purpose**: Main orchestration service
- **Process**:
  1. Fetches original calendar
  2. Parses each event's description
  3. Extracts location information
  4. Maps abbreviated locations to full names
  5. Updates LOCATION property in events
  6. Returns enriched calendar

### 5. CalendarEnricherApplication
- **Location**: `src/main/java/com/kcl/calendar/CalendarEnricherApplication.java`
- **Purpose**: HTTP server for serving enriched calendars
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /enrich?url=<calendar-url>` - Enrich and return calendar
  - `GET /subscribe/{urlParam}` - Subscribe endpoint (redirects to /enrich)
- **Features**:
  - 5-minute cache for enriched calendars
  - Proper ICS content-type headers
  - Error handling with appropriate HTTP status codes

## Building and Testing

### Build the project
```bash
mvn clean compile
```

### Run all tests (29 tests)
```bash
mvn test
```

### Run specific test class
```bash
mvn test -Dtest=EventBodyParserTest
mvn test -Dtest=LocationMapperTest
mvn test -Dtest=CalendarFetcherTest
mvn test -Dtest=CalendarEnricherTest
```

### Package the application
```bash
mvn clean package
```

This creates an executable JAR: `target/kcl-calendar-enricher-1.0-SNAPSHOT.jar`

## Running the Application

### Run from Maven
```bash
mvn exec:java -Dexec.mainClass="com.kcl.calendar.CalendarEnricherApplication"
```

### Run the packaged JAR
```bash
java -jar target/kcl-calendar-enricher-1.0-SNAPSHOT.jar [port]
```

Default port is 8080. You can specify a different port as a command-line argument.

### Example Usage

1. Start the server:
   ```bash
   java -jar target/kcl-calendar-enricher-1.0-SNAPSHOT.jar 8080
   ```

2. Enrich a calendar:
   ```bash
   curl "http://localhost:8080/enrich?url=https://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/REDACTED-TIMETABLE-ID/REDACTED-TIMETABLE-ID/timetable.ics"
   ```

3. Subscribe in your calendar app:
   - Use URL: `http://localhost:8080/enrich?url=<your-kcl-calendar-url>`
   - The calendar app will fetch the enriched calendar

## Test-Driven Development Approach

This project was built using TDD principles:

1. **EventBodyParserTest** (8 tests): Tests for parsing event descriptions
2. **LocationMapperTest** (10 tests): Tests for location mapping
3. **CalendarFetcherTest** (5 tests): Tests for fetching calendars from URLs
4. **CalendarEnricherTest** (6 tests): Integration tests for the enrichment service

All tests are written before implementation, ensuring:
- Clear requirements
- Edge case handling
- Regression prevention
- Documentation through examples

## ICS 2.0 Compliance

The application:
- Accepts ICS 2.0 feeds (KCL already uses 2.0)
- Maintains ICS 2.0 format in output
- Preserves all original calendar properties
- Only modifies LOCATION properties based on parsed descriptions

## Adding New Building Mappings

To add new building codes:

1. Edit `src/main/resources/location-mappings.properties`
2. Add entries in format: `CODE=Full Building Name, Campus, Postal Code`
3. Example:
   ```properties
   NEW_BLDG=New Building - King's College London, Campus Name, Postcode
   NBL=New Building - King's College London, Campus Name, Postcode
   ```
4. Rebuild and restart the application

## Cache Configuration

The application caches enriched calendars for 5 minutes (300 seconds). To modify:

Edit `CalendarEnricherApplication.java:19`:
```java
private final long cacheTTLMillis = 5 * 60 * 1000; // Change this value
```

## Error Handling

The application handles:
- Invalid URLs (400 Bad Request)
- Network errors (502 Bad Gateway)
- Parse errors (502 Bad Gateway)
- Invalid calendar format (502 Bad Gateway)
- Internal errors (500 Internal Server Error)

## Future Enhancements

Potential improvements:
- Persistent cache (Redis/database)
- Automatic sync service with webhooks
- Support for multiple calendar sources
- Admin UI for managing building mappings
- Metrics and monitoring
- Docker containerization
- API authentication

## Dependencies

Key dependencies in `pom.xml`:
- `ical4j` 3.2.14 - ICS parsing and generation
- `javalin` 5.6.3 - HTTP server
- `httpclient5` 5.3 - HTTP client for fetching calendars
- `junit-jupiter` 5.10.1 - Testing framework
- `mockito` 5.8.0 - Mocking for tests

## IntelliJ IDEA Integration

This project is configured as an IntelliJ IDEA project:
- `.iml` file for module configuration
- Maven is the primary build tool
- Java 17+ required
- Tests can be run directly from the IDE

## Troubleshooting

### Tests failing with network errors
- Tests `CalendarFetcherTest` and `CalendarEnricherTest` make real HTTP requests to KCL servers
- Ensure you have internet connectivity
- KCL servers must be accessible

### Location mappings not working
- Check `location-mappings.properties` is in `src/main/resources/`
- Verify file is included in the JAR (check `target/classes/`)
- Ensure property keys match the abbreviations in calendar descriptions

### Port already in use
- Change the port: `java -jar target/kcl-calendar-enricher-1.0-SNAPSHOT.jar 8081`
- Or stop the process using port 8080

## License and Usage

This is a personal project for enriching KCL calendar feeds. Not affiliated with King's College London.
