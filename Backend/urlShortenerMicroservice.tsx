import express, { Request, Response } from 'express';
import { Log, LogLevel, BackendPackage } from '../LoggingMiddleware/reusableFunction';

const app = express();
app.use(express.json());

// In-memory storage (replace with database in production)
interface ShortUrl {
    id: string;
    originalUrl: string;
    shortCode: string;
    expiry: Date;
    clickCount: number;
    clicks: Array<{
        timestamp: Date;
        referrer?: string;
        location?: string;
    }>;
    createdAt: Date;
}

const urlDatabase = new Map<string, ShortUrl>();

// Generate random shortcode
function generateShortCode(): string {
    return Math.random().toString(36).substring(2, 8);
}

// Validate URL format
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// Create Short URL - POST /shorturls
app.post('/shorturls', async (req: Request, res: Response) => {
    try {
        await Log('info', 'backend', 'handler', 'POST /shorturls - Creating short URL');

        const { url, validity = 30, shortcode } = req.body;

        // Validate required fields
        if (!url) {
            await Log('warn', 'backend', 'handler', 'POST /shorturls - Missing URL field');
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate URL format
        if (!isValidUrl(url)) {
            await Log('warn', 'backend', 'handler', `POST /shorturls - Invalid URL format: ${url}`);
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Validate validity
        if (validity <= 0) {
            await Log('warn', 'backend', 'handler', `POST /shorturls - Invalid validity: ${validity}`);
            return res.status(400).json({ error: 'Validity must be positive integer' });
        }

        let finalShortCode = shortcode;

        // If custom shortcode provided, validate it
        if (shortcode) {
            if (urlDatabase.has(shortcode)) {
                await Log('warn', 'backend', 'handler', `POST /shorturls - Shortcode collision: ${shortcode}`);
                return res.status(409).json({ error: 'Shortcode already exists' });
            }
            if (!/^[a-zA-Z0-9]+$/.test(shortcode) || shortcode.length < 3 || shortcode.length > 10) {
                await Log('warn', 'backend', 'handler', `POST /shorturls - Invalid shortcode format: ${shortcode}`);
                return res.status(400).json({ error: 'Shortcode must be alphanumeric, 3-10 characters' });
            }
        } else {
            // Generate unique shortcode
            do {
                finalShortCode = generateShortCode();
            } while (urlDatabase.has(finalShortCode));
        }

        // Calculate expiry
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + validity);

        // Create short URL record
        const shortUrl: ShortUrl = {
            id: finalShortCode,
            originalUrl: url,
            shortCode: finalShortCode,
            expiry,
            clickCount: 0,
            clicks: [],
            createdAt: new Date()
        };

        // Store in database
        urlDatabase.set(finalShortCode, shortUrl);
        
        await Log('info', 'backend', 'db', `Short URL created - Code: ${finalShortCode}, URL: ${url}`);
        await Log('info', 'backend', 'handler', `POST /shorturls - SUCCESS - ShortCode: ${finalShortCode}`);

        // Return EXACT response format as specified
        res.status(201).json({
            shortLink: `https://hostname:port/${finalShortCode}`,
            expiry: expiry.toISOString()
        });

    } catch (error) {
        await Log('error', 'backend', 'handler', `POST /shorturls - ERROR: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Missing redirection endpoint - GET /:shortcode (from specification)
app.get('/:shortcode', async (req: Request, res: Response) => {
    try {
        const { shortcode } = req.params;
        
        await Log('info', 'backend', 'handler', `GET /${shortcode} - Accessing short URL`);

        // Find URL in database
        const shortUrl = urlDatabase.get(shortcode);
        
        if (!shortUrl) {
            await Log('warn', 'backend', 'db', `Short URL not found: ${shortcode}`);
            return res.status(404).json({ error: 'Short URL not found' });
        }

        // Check if expired
        if (new Date() > shortUrl.expiry) {
            await Log('warn', 'backend', 'handler', `Short URL expired: ${shortcode}`);
            return res.status(410).json({ error: 'Short URL has expired' });
        }

        // Record click analytics
        const clickData = {
            timestamp: new Date(),
            referrer: req.get('Referer'),
            location: req.ip || 'unknown'
        };
        
        shortUrl.clicks.push(clickData);
        shortUrl.clickCount++;

        await Log('info', 'backend', 'service', `URL accessed - ${shortcode} -> ${shortUrl.originalUrl} (Click #${shortUrl.clickCount})`);
        await Log('info', 'backend', 'handler', `GET /${shortcode} - SUCCESS - Redirecting to ${shortUrl.originalUrl}`);

        // Redirect to original URL as per specification
        res.redirect(302, shortUrl.originalUrl);

    } catch (error) {
        await Log('error', 'backend', 'handler', `GET /:shortcode - ERROR: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Statistics - GET /shorturls/:shortcode (EXACT specification format)
app.get('/shorturls/:shortcode', async (req: Request, res: Response) => {
    try {
        const { shortcode } = req.params;
        
        await Log('info', 'backend', 'handler', `GET /shorturls/${shortcode} - Retrieving statistics`);

        // Find URL in database
        const shortUrl = urlDatabase.get(shortcode);
        
        if (!shortUrl) {
            await Log('warn', 'backend', 'db', `Statistics requested for non-existent shortcode: ${shortcode}`);
            return res.status(404).json({ error: 'Short URL not found' });
        }

        // Return EXACT format as per specification
        const statistics = {
            // Total number of times the short link has been clicked
            totalClicks: shortUrl.clickCount,
            
            // Information about the original URL, creation date, and expiry date
            originalUrl: shortUrl.originalUrl,
            creationDate: shortUrl.createdAt.toISOString(),
            expiryDate: shortUrl.expiry.toISOString(),
            
            // Detailed click data for each interaction
            clickDetails: shortUrl.clicks.map(click => ({
                timestamp: click.timestamp.toISOString(),
                referrer: click.referrer || 'direct',
                location: click.location || 'unknown'
            }))
        };

        await Log('info', 'backend', 'service', `Statistics retrieved for ${shortcode} - ${shortUrl.clickCount} total clicks`);
        await Log('info', 'backend', 'handler', `GET /shorturls/${shortcode} - SUCCESS`);

        res.json(statistics);

    } catch (error) {
        await Log('error', 'backend', 'handler', `GET /shorturls/:shortcode - ERROR: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
    await Log('debug', 'backend', 'service', 'Health check accessed');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await Log('info', 'backend', 'service', `URL Shortener service started on port ${PORT}`);
    console.log(`Server running on port ${PORT}`);
});

export default app;