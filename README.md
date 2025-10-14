# KCL Calendar Enricher

A Java application that enriches King's College London (KCL) ICS calendar feeds with proper location metadata. Transforms abbreviated building codes like "KINGS BLDG" into full addresses like "King's Building - King's College London, Strand Campus, London WC2R 2LS".

## Features

- ✅ Fetches ICS calendar feeds from KCL's Scientia system
- ✅ Parses event descriptions to extract location information
- ✅ Maps abbreviated building codes to full addresses
- ✅ Serves enriched calendar feeds via HTTP
- ✅ 5-minute caching for performance
- ✅ ICS 2.0 compliant
- ✅ Built with Test-Driven Development (TDD) - 29 passing tests

## Quick Start

### Prerequisites

- Java 17 or higher
- Maven 3.9 or higher

### Build

```bash
mvn clean package
```

### Run

```bash
java -jar target/kcl-calendar-enricher-1.0-SNAPSHOT.jar
```

The server will start on port 8080.

### Usage

Enrich your KCL calendar by making a GET request:

```bash
curl "http://localhost:8080/enrich?url=YOUR_KCL_CALENDAR_URL"
```

Or subscribe in your calendar app using:
```
http://localhost:8080/enrich?url=YOUR_KCL_CALENDAR_URL
```

Replace `YOUR_KCL_CALENDAR_URL` with your actual KCL calendar subscription URL.

## Example

**Before (Original KCL Calendar):**
```
LOCATION: KINGS BLDG KIN 625
```

**After (Enriched):**
```
LOCATION: King's Building - King's College London, Strand Campus, London WC2R 2LS, Room 625 (Anatomy Lecture Theatre)
```

## Building Codes Supported

- King's Building (KINGS BLDG, KIN)
- Strand Building (STRAND BLDG, STR)
- Franklin-Wilkins Building (WATERLOO, FWB)
- Bush House (BUSH HOUSE, BSH)
- Somerset House (SOMERSET HOUSE, SOM)
- Maughan Library (MAUGHAN, MAU)
- Guy's Campus (GUYS, GUY)
- St Thomas' Campus (ST_THOMAS, STH)
- Denmark Hill Campus (DENMARK_HILL, DEN)

## Docker Deployment

### Development
```bash
# Build and run locally
docker-compose -f docker-compose.dev.yml up --build
```

### Production
See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment instructions using Portainer and Cloudflare Tunnel.

Quick production start:
```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your Cloudflare tunnel token
# Then start the services
docker-compose up -d
```

The production setup includes:
- Application container with health checks
- Cloudflare Tunnel for secure access
- Shared internal network
- Automatic restarts and log rotation

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

### On Pull Request
- ✅ Run tests with JUnit 5
- ✅ Generate code coverage reports with JaCoCo (minimum 50% coverage)
- ✅ Upload test results and coverage artifacts

### On Push to Main
- ✅ Run full test suite
- ✅ Build Docker image
- ✅ Push to GitHub Container Registry
- ✅ Tag with `latest` and commit SHA

**Docker Image**: `ghcr.io/eggsleggs/kcl-calendar-enricher:latest`

## Testing

### Setting up Test Environment

Tests require a valid KCL calendar URL to be set as an environment variable:

```bash
export TEST_CALENDAR_URL="https://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/.../timetable.ics"
```

**Note:** For security, the calendar URL is not hardcoded in tests and must be provided via environment variable.

### Running Tests

Run all tests:
```bash
mvn test
```

Run tests with coverage:
```bash
mvn clean verify
```

Coverage reports are generated in `target/site/jacoco/index.html`

Tests run: 29, Failures: 0, Errors: 0, Skipped: 0

### CI/CD Test Configuration

For GitHub Actions CI/CD, add the `TEST_CALENDAR_URL` as a repository secret:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `TEST_CALENDAR_URL`
4. Value: Your KCL calendar URL
5. Click "Add secret"

The CI workflow will automatically use this secret when running tests.

## Project Structure

```
src/
├── main/java/com/kcl/calendar/
│   ├── CalendarEnricherApplication.java  # Main application
│   ├── model/EventMetadata.java          # Event data model
│   ├── parser/EventBodyParser.java       # Parses event descriptions
│   └── service/
│       ├── CalendarEnricher.java         # Main enrichment service
│       ├── CalendarFetcher.java          # Fetches calendars
│       └── LocationMapper.java           # Maps locations
└── test/java/com/kcl/calendar/          # 29 JUnit tests
```

## API Endpoints

- `GET /health` - Health check
- `GET /enrich?url=<calendar-url>` - Enrich and return calendar
- `GET /subscribe/{urlParam}` - Subscribe endpoint

## Configuration

Edit `src/main/resources/location-mappings.properties` to add or modify building mappings.

## Development

This project was built using Test-Driven Development (TDD) with JUnit 5. Each component has comprehensive tests written before implementation.

## Technology Stack

- Java 17
- Maven 3.9
- iCal4j 3.2.14 (ICS parsing)
- Javalin 5.6.3 (HTTP server)
- JUnit 5 (Testing)

## License

Personal project for enriching KCL calendar feeds. Not affiliated with King's College London.

## Documentation

For detailed documentation, see [.claude/project-spec.md](.claude/project-spec.md)
