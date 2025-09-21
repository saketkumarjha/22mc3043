export interface ShortUrl {
    id: string;
    originalUrl: string;
    shortCode: string;
    expiry: Date;
    clickCount: number;
    clicks: ClickData[];
    createdAt: Date;
}

export interface ClickData {
    timestamp: Date;
    referrer?: string;
    location?: string;
}

export interface CreateUrlRequest {
    url: string;
    validity?: number;
    shortcode?: string;
}

export interface CreateUrlResponse {
    shortLink: string;
    expiry: string;
}

export interface StatisticsResponse {
    totalClicks: number;
    originalUrl: string;
    creationDate: string;
    expiryDate: string;
    clickDetails: Array<{
        timestamp: string;
        referrer: string;
        location: string;
    }>;
}