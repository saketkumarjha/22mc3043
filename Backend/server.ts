import app from "./app";
import { Log } from "../Backend/controller/LoggingMiddleware/reusableFunction";

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await Log(
    "info",
    "backend",
    "service",
    `URL Shortener service started on port ${PORT}`
  );
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
