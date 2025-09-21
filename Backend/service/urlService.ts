import { ShortUrl, ClickData } from "../src/models/shortUrl";
import { Log } from "../../Backend/controller/LoggingMiddleware/reusableFunction";

// In-memory storage (replace with database in production)
const urlDatabase = new Map<string, ShortUrl>();

export class UrlService {
  // Generate random shortcode
  static generateShortCode(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  // Validate URL format
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Create short URL
  static async createShortUrl(
    url: string,
    validity: number = 30,
    customShortcode?: string
  ): Promise<ShortUrl> {
    await Log("info", "backend", "service", `Creating short URL for: ${url}`);

    let finalShortCode = customShortcode;

    // If custom shortcode provided, validate it
    if (customShortcode) {
      if (urlDatabase.has(customShortcode)) {
        await Log(
          "error",
          "backend",
          "service",
          `Shortcode collision: ${customShortcode}`
        );
        throw new Error("Shortcode already exists");
      }
      if (
        !/^[a-zA-Z0-9]+$/.test(customShortcode) ||
        customShortcode.length < 3 ||
        customShortcode.length > 10
      ) {
        await Log(
          "error",
          "backend",
          "service",
          `Invalid shortcode format: ${customShortcode}`
        );
        throw new Error("Shortcode must be alphanumeric, 3-10 characters");
      }
    } else {
      // Generate unique shortcode
      do {
        finalShortCode = this.generateShortCode();
      } while (urlDatabase.has(finalShortCode));
    }

    // Calculate expiry
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + validity);

    // Ensure finalShortCode is not undefined
    if (!finalShortCode) {
      throw new Error("Failed to generate shortcode");
    }

    // Create short URL record
    const shortUrl: ShortUrl = {
      id: finalShortCode,
      originalUrl: url,
      shortCode: finalShortCode,
      expiry,
      clickCount: 0,
      clicks: [],
      createdAt: new Date(),
    };

    // Store in database
    urlDatabase.set(finalShortCode, shortUrl);

    await Log(
      "info",
      "backend",
      "db",
      `Short URL created - Code: ${finalShortCode}`
    );
    return shortUrl;
  }

  // Get URL by shortcode
  static async getUrlByShortcode(shortcode: string): Promise<ShortUrl | null> {
    await Log(
      "debug",
      "backend",
      "service",
      `Looking up shortcode: ${shortcode}`
    );
    return urlDatabase.get(shortcode) || null;
  }

  // Record click
  static async recordClick(
    shortcode: string,
    referrer?: string,
    location?: string
  ): Promise<void> {
    const shortUrl = urlDatabase.get(shortcode);
    if (shortUrl) {
      const clickData: ClickData = {
        timestamp: new Date(),
        referrer,
        location,
      };

      shortUrl.clicks.push(clickData);
      shortUrl.clickCount++;

      await Log(
        "info",
        "backend",
        "service",
        `Click recorded for ${shortcode} - Total: ${shortUrl.clickCount}`
      );
    }
  }

  // Check if URL is expired
  static isExpired(shortUrl: ShortUrl): boolean {
    return new Date() > shortUrl.expiry;
  }
}
