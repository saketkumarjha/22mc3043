import { Router } from "express";
import { UrlController } from "../../Backend/controller/urlController";

const router = Router();

// Create Short URL
router.post("/shorturls", UrlController.createUrl);

// Get Statistics
router.get("/shorturls/:shortcode", UrlController.getStatistics);

// Access Short URL (redirect)
router.get("/:shortcode", UrlController.redirectUrl);

export default router;
