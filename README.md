# KCL Calendar Enricher

A Java application that enriches King's College London (KCL) ICS calendar feeds with proper location metadata for Apple Calendar and other calendar applications. Updates the location field with full addresses for geocoding, while preserving original room details in the event description.

## ✨ Live Service

The service is live at **https://kcl-calendar-enricher.thinkhuman.dev**

### How to Use

1. **Get your KCL calendar URL** from https://mytimetable.kcl.ac.uk/ (it looks like `https://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/.../timetable.ics` and is provided when you click the subscribe button)

2. **Subscribe in your calendar app** using the enriched URL:
   ```
   https://kcl-calendar-enricher.thinkhuman.dev/enrich?url=YOUR_KCL_CALENDAR_URL
   ```

3. **Or test it directly** with curl:
   ```bash
   curl "https://kcl-calendar-enricher.thinkhuman.dev/enrich?url=YOUR_KCL_CALENDAR_URL"
   ```

**Note:** Replace `YOUR_KCL_CALENDAR_URL` with your actual KCL calendar subscription URL (URL-encoded if using in a browser).

## Features

- ✅ Fetches ICS calendar feeds from KCL's Scientia system
- ✅ Parses event descriptions to extract location information
- ✅ Maps abbreviated building codes to full addresses
- ✅ Serves enriched calendar feeds via HTTP
- ✅ 5-minute caching for performance
- ✅ ICS 2.0 compliant
- ✅ Built with Test-Driven Development (TDD)

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
DESCRIPTION: Module Code: 6CCS3PRJ
             Location: KINGS BLDG KIN 625
```

**After (Enriched):**
```
LOCATION: 33-41 Surrey St, London, WC2R 2ND, England
DESCRIPTION: Module Code: 6CCS3PRJ
             Location: KINGS BLDG KIN 625
```

The enricher updates only the LOCATION field with the full address for proper geocoding in calendar apps (particularly Apple Calendar). The original location details including room numbers remain in the event description.

<<<<<<< Updated upstream
=======
## Security: URL Validation

For security, the service strictly validates all calendar URLs with the following requirements:

- **HTTPS Only**: Only HTTPS URLs are accepted
- **Exact Domain**: Must be from `scientia-eu-v4-api-d4-02.azurewebsites.net` (KCL's official Scientia calendar domain)
- **Path Requirements**:
  - Must start with `/api/ical/`
  - Must end with `/timetable.ics`

Any URL that doesn't meet these criteria will be rejected with a `400 Bad Request` response.

**Valid URL format:**
```
https://scientia-eu-v4-api-d4-02.azurewebsites.net/api/ical/{uuid}/{uuid}/timetable.ics
```

**Examples:**
- ✅ `https://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/{uuid}/{uuid}/timetable.ics`
- ❌ `http://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/.../timetable.ics` (not HTTPS)
- ❌ `https://other-domain.azurewebsites.net//api/ical/.../timetable.ics` (wrong domain)
- ❌ `https://scientia-eu-v4-api-d4-02.azurewebsites.net/other/path/.../timetable.ics` (wrong path prefix)
- ❌ `https://scientia-eu-v4-api-d4-02.azurewebsites.net//api/ical/.../calendar.ics` (wrong filename)

>>>>>>> Stashed changes
## Building Codes Supported

- King's Building (KINGS_BLDG, KINGS_BDLG, KIN) → 33-41 Surrey St, London, WC2R 2ND
- Strand Building (STRAND_BLDG, STR) → 33-41 Surrey St, London, WC2R 2ND
- Franklin-Wilkins Building (WATERLOO, FWB) → Stamford St, London SE1 9NH
- Bush House (BUSH_HOUSE, BSH) → 30 Bush House, Aldwych, London, WC2B 4BG
- IET Turing (IET_TURING, IET, TURING) → 2 Savoy Pl, London, WC2R 0BL
- Somerset House (SOMERSET_HOUSE, SOM) → Somerset House, Strand, London WC2R 1LA
- Maughan Library (MAUGHAN, MAU) → Chancery Lane, London WC2A 1LR
- Guy's Campus (GUYS, GUY) → Great Maze Pond, London SE1 1UL
- St Thomas' Campus (ST_THOMAS, STH) → Westminster Bridge Rd, London SE1 7EH
- Denmark Hill Campus (DENMARK_HILL, DEN) → Denmark Hill, London SE5 9RS

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
- ✅ Post coverage summary as PR comment with detailed metrics
- ✅ Upload test results and coverage artifacts

### On Push to Main
- ✅ Run full test suite
- ✅ Build Docker image
- ✅ Push to GitHub Container Registry
- ✅ Tag with `latest` and commit SHA
- ✅ Trigger Portainer webhook for automatic redeployment

**Docker Image**: `ghcr.io/eggsleggs/kcl-calendar-enricher:latest`

### Required GitHub Secrets

The following secrets must be configured in your repository (Settings → Secrets and variables → Actions):

1. **`TEST_CALENDAR_URL`** - Your KCL calendar URL for running integration tests
2. **`PORTAINER_WEBHOOK_URL`** - Portainer webhook URL for triggering automatic redeployment
3. **`CF_ACCESS_CLIENT_ID`** - Cloudflare Zero Trust client ID for Portainer webhook authentication
4. **`CF_ACCESS_CLIENT_SECRET`** - Cloudflare Zero Trust client secret for Portainer webhook authentication

**Security Note:** Never commit these secrets to the repository. They are automatically injected by GitHub Actions during CI/CD runs.

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
└── test/java/com/kcl/calendar/          # JUnit tests
```

## API Endpoints

- `GET /health` - Health check
- `GET /enrich?url=<calendar-url>` - Enrich and return calendar

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
