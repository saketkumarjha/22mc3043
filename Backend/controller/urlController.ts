import { Request, Response } from "express";
import { UrlService } from "../service/urlService";
import { Log } from "./LoggingMiddleware/reusableFunction";
import {
  CreateUrlRequest,
  CreateUrlResponse,
  StatisticsResponse,
} from "../types/urlTypes"

export class UrlController {
  // Create Short URL - POST /shorturls
  static async createUrl(req: Request, res: Response): Promise<void> {
    try {
      await Log(
        "info",
        "backend",
        "handler",
        "POST /shorturls - Creating short URL"
      );

      const { url, validity = 30, shortcode }: CreateUrlRequest = req.body;

      // Validate required fields
      if (!url) {
        await Log(
          "warn",
          "backend",
          "handler",
          "POST /shorturls - Missing URL field"
        );
        res.status(400).json({ error: "URL is required" });
        return;
      }

      // Validate URL format
      if (!UrlService.isValidUrl(url)) {
        await Log(
          "warn",
          "backend",
          "handler",
          `POST /shorturls - Invalid URL format: ${url}`
        );
        res.status(400).json({ error: "Invalid URL format" });
        return;
      }

      // Validate validity
      if (validity <= 0) {
        await Log(
          "warn",
          "backend",
          "handler",
          `POST /shorturls - Invalid validity: ${validity}`
        );
        res.status(400).json({ error: "Validity must be positive integer" });
        return;
      }

      // Create short URL
      const shortUrl = await UrlService.createShortUrl(
        url,
        validity,
        shortcode
      );

      await Log(
        "info",
        "backend",
        "handler",
        `POST /shorturls - SUCCESS - ShortCode: ${shortUrl.shortCode}`
      );

      // Return EXACT response format as specified
      const response: CreateUrlResponse = {
        shortLink: `https://hostname:port/${shortUrl.shortCode}`,
        expiry: shortUrl.expiry.toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Shortcode already exists") {
          await Log(
            "warn",
            "backend",
            "handler",
            `POST /shorturls - Shortcode collision`
          );
          res.status(409).json({ error: "Shortcode already exists" });
          return;
        }
        if (error.message.includes("Shortcode must be alphanumeric")) {
          await Log(
            "warn",
            "backend",
            "handler",
            `POST /shorturls - Invalid shortcode format`
          );
          res
            .status(400)
            .json({ error: "Shortcode must be alphanumeric, 3-10 characters" });
          return;
        }
      }

      await Log(
        "error",
        "backend",
        "handler",
        `POST /shorturls - ERROR: ${error}`
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Access Short URL - GET /:shortcode
  static async redirectUrl(req: Request, res: Response): Promise<void> {
    try {
      const { shortcode } = req.params;

      await Log(
        "info",
        "backend",
        "handler",
        `GET /${shortcode} - Accessing short URL`
      );

      // Find URL in database
      const shortUrl = await UrlService.getUrlByShortcode(shortcode);

      if (!shortUrl) {
        await Log("warn", "backend", "db", `Short URL not found: ${shortcode}`);
        res.status(404).json({ error: "Short URL not found" });
        return;
      }

      // Check if expired
      if (UrlService.isExpired(shortUrl)) {
        await Log(
          "warn",
          "backend",
          "handler",
          `Short URL expired: ${shortcode}`
        );
        res.status(410).json({ error: "Short URL has expired" });
        return;
      }

      // Record click analytics
      await UrlService.recordClick(
        shortcode,
        req.get("Referer"),
        req.ip || "unknown"
      );

      await Log(
        "info",
        "backend",
        "handler",
        `GET /${shortcode} - SUCCESS - Redirecting to ${shortUrl.originalUrl}`
      );

      // Redirect to original URL as per specification
      res.redirect(302, shortUrl.originalUrl);
    } catch (error) {
      await Log(
        "error",
        "backend",
        "handler",
        `GET /:shortcode - ERROR: ${error}`
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get Statistics - GET /shorturls/:shortcode
  static async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { shortcode } = req.params;

      await Log(
        "info",
        "backend",
        "handler",
        `GET /shorturls/${shortcode} - Retrieving statistics`
      );

      // Find URL in database
      const shortUrl = await UrlService.getUrlByShortcode(shortcode);

      if (!shortUrl) {
        await Log(
          "warn",
          "backend",
          "db",
          `Statistics requested for non-existent shortcode: ${shortcode}`
        );
        res.status(404).json({ error: "Short URL not found" });
        return;
      }

      // Return EXACT format as per specification
      const statistics: StatisticsResponse = {
        // Total number of times the short link has been clicked
        totalClicks: shortUrl.clickCount,

        // Information about the original URL, creation date, and expiry date
        originalUrl: shortUrl.originalUrl,
        creationDate: shortUrl.createdAt.toISOString(),
        expiryDate: shortUrl.expiry.toISOString(),

        // Detailed click data for each interaction
        clickDetails: shortUrl.clicks.map((click) => ({
          timestamp: click.timestamp.toISOString(),
          referrer: click.referrer || "direct",
          location: click.location || "unknown",
        })),
      };

      await Log(
        "info",
        "backend",
        "service",
        `Statistics retrieved for ${shortcode} - ${shortUrl.clickCount} total clicks`
      );
      await Log(
        "info",
        "backend",
        "handler",
        `GET /shorturls/${shortcode} - SUCCESS`
      );

      res.json(statistics);
    } catch (error) {
      await Log(
        "error",
        "backend",
        "handler",
        `GET /shorturls/:shortcode - ERROR: ${error}`
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
