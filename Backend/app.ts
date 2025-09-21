import express from "express";
import cors from "cors";
import urlRoutes from "./routes/urlRoutes";
import { Log } from "../Backend/controller/LoggingMiddleware/reusableFunction";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/", urlRoutes);

export default app;
