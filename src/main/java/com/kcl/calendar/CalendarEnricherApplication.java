package com.kcl.calendar;

import com.kcl.calendar.service.CalendarEnricher;
import io.javalin.Javalin;
import io.javalin.http.Context;
import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Main application for the KCL Calendar Enricher.
 * Provides an HTTP server that enriches KCL calendar feeds on-the-fly.
 */
public class CalendarEnricherApplication {

    private static final int DEFAULT_PORT = 8080;
    private final CalendarEnricher enricher;
    private final Map<String, CachedCalendar> cache;
    private final long cacheTTLMillis = 5 * 60 * 1000; // 5 minutes

    public CalendarEnricherApplication() {
        this.enricher = new CalendarEnricher();
        this.cache = new ConcurrentHashMap<>();
    }

    /**
     * Starts the HTTP server.
     *
     * @param port the port to listen on
     */
    public void start(int port) {
        Javalin app = Javalin.create(config -> {
            config.showJavalinBanner = false;
        }).start(port);

        // Health check endpoint
        app.get("/health", ctx -> {
            ctx.result("OK");
        });

        // Main enrichment endpoint
        // Usage: /enrich?url=<your-kcl-calendar-url>
        app.get("/enrich", this::handleEnrichRequest);

        // Subscribe endpoint with URL parameter
        // Usage: /subscribe/<base64-encoded-url>
        app.get("/subscribe/{urlParam}", this::handleSubscribeRequest);

        System.out.println("KCL Calendar Enricher started on port " + port);
        System.out.println("Usage:");
        System.out.println("  GET /enrich?url=<your-kcl-calendar-url>");
        System.out.println("  GET /subscribe/<url-parameter>");
        System.out.println("  GET /health");
    }

    /**
     * Handles the enrichment request.
     */
    private void handleEnrichRequest(Context ctx) {
        String sourceUrl = ctx.queryParam("url");

        if (sourceUrl == null || sourceUrl.isEmpty()) {
            ctx.status(400).result("Missing 'url' query parameter");
            return;
        }

        try {
            // Check cache first
            CachedCalendar cached = cache.get(sourceUrl);
            if (cached != null && !cached.isExpired()) {
                ctx.contentType("text/calendar; charset=utf-8")
                   .result(cached.icsContent);
                return;
            }

            // Enrich the calendar
            Calendar enrichedCalendar = enricher.enrichCalendar(sourceUrl);
            String icsContent = enricher.toIcsString(enrichedCalendar);

            // Cache it
            cache.put(sourceUrl, new CachedCalendar(icsContent, System.currentTimeMillis() + cacheTTLMillis));

            // Return the enriched calendar
            ctx.contentType("text/calendar; charset=utf-8")
               .result(icsContent);

        } catch (IllegalArgumentException e) {
            ctx.status(400).result("Invalid URL: " + e.getMessage());
        } catch (IOException e) {
            ctx.status(502).result("Error fetching calendar: " + e.getMessage());
        } catch (ParserException e) {
            ctx.status(502).result("Error parsing calendar: " + e.getMessage());
        } catch (Exception e) {
            ctx.status(500).result("Internal server error: " + e.getMessage());
        }
    }

    /**
     * Handles the subscribe request with URL parameter.
     */
    private void handleSubscribeRequest(Context ctx) {
        String urlParam = ctx.pathParam("urlParam");

        if (urlParam == null || urlParam.isEmpty()) {
            ctx.status(400).result("Missing URL parameter");
            return;
        }

        // For now, just redirect to the enrich endpoint
        // In a production system, you might want to decode a base64 encoded URL
        ctx.redirect("/enrich?url=" + urlParam);
    }

    /**
     * Simple cache entry with expiration.
     */
    private class CachedCalendar {
        final String icsContent;
        final long expiresAt;

        CachedCalendar(String icsContent, long expiresAt) {
            this.icsContent = icsContent;
            this.expiresAt = expiresAt;
        }

        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }

    /**
     * Main entry point.
     */
    public static void main(String[] args) {
        int port = DEFAULT_PORT;

        if (args.length > 0) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException e) {
                System.err.println("Invalid port number: " + args[0]);
                System.err.println("Using default port: " + DEFAULT_PORT);
            }
        }

        CalendarEnricherApplication app = new CalendarEnricherApplication();
        app.start(port);
    }
}
