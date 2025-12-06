import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import itemsRouter from "./routes/items.js";
import exchangeRouter from "./routes/exchange.js";
import "./db.js"; // Ensure DB is initialized before routes use it.

dotenv.config(); // file kidhar hai ?? 

const app = express();
const PORT = process.env.PORT || 5001;

// Allow frontend dev server to call the API.
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
// Parse JSON request bodies.
app.use(express.json());

// Route wiring.
app.use("/api/items", itemsRouter);
app.use("/api/exchange-rate", exchangeRouter);

// Centralized error handler to avoid leaking stack traces.
app.use((err, _req, res, _next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
