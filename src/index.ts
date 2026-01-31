import "dotenv/config";
import express from "express";
import cors from "cors";
import crewRoutes from "./routes/crew";
import jobRoutes from "./routes/job";
import authTestRoutes from "./routes/_auth-test";

app.use("/api", authTestRoutes);

const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      "https://jobhub-web-production.up.railway.app",
      "http://localhost:3000",
      "http://localhost:19006",
    ],
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Crew endpoints (browser links will hit this)
app.use("/api/crew", crewRoutes);
app.use("/api", jobRoutes);

const port = process.env.PORT ? Number(process.env.PORT) : 8787;

app.listen(port, "0.0.0.0", () => {
  console.log("🚀 Backend listening on port", port);
});
