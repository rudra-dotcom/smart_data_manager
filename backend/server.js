import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./db.js"; // initialize DBs
import baseItemsRouter from "./routes/baseItems.js";
import purchasesRouter from "./routes/purchases.js";
import exchangeRouter from "./routes/exchange.js";
import chatRouter from "./routes/chat.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.use("/api/base-items", baseItemsRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/exchange-rate", exchangeRouter);
app.use("/api/chat", chatRouter);

app.use((err, _req, res, _next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});
app.get("/", (_req, res) => {
  res.send("Backend is running");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
