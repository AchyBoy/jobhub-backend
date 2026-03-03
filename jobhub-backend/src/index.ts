//JobHub/jobhub-backend/src/index.ts

// Load .env locally only (Railway injects env vars in production)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

console.log("🧪 BACKEND DATABASE_URL =", process.env.DATABASE_URL);

import templateRoutes from "./routes/templates";
import { testPostgresConnection } from "./db/postgres";
import express from "express";
import cors from "cors";
import crewRoutes from "./routes/crew";
import jobRoutes from "./routes/job";
import tenantRoutes from "./routes/tenant";
import phaseGroupsRouter from './routes/phaseGroups';
import phasesRoutes from "./routes/phases";
import crewsRoutes from "./routes/crews";
import pushRoutes from "./routes/push";
import jobPdfsRoutes from "./routes/jobPdfs";
import pdfOverlayRoutes from "./routes/pdfOverlays";
import { activateDuePhases } from "./automation/activateDuePhases";
import contractorPhaseNotes from "./routes/contractorPhaseNotes";
import ordersRouter from "./routes/orders";
import tenantUsersRoutes from "./routes/tenantUsers";
import supervisorPhaseNotes from './routes/supervisorPhaseNotes';
import serviceCasesRouter from "./routes/serviceCases";
import contractorsRoutes from "./routes/contractors";
import vendorsRoutes from "./routes/vendors";
import jobVendorsRoutes from "./routes/jobVendors";
import jobContractorsRoutes from "./routes/jobContractors";
import jobCrewsRoutes from "./routes/jobCrews";
import jobDefaultsRoutes from "./routes/jobDefaults";
import materialsRoutes from "./routes/materials";
import jobSupervisorsRoutes from "./routes/jobSupervisors";
import suppliersRoutes from "./routes/suppliers";
import supervisorsRoutes from "./routes/supervisors";
import { startPushScheduler } from "./services/pushScheduler";
import permitCompaniesRoutes from "./routes/permitCompanies";
import jobPermitCompaniesRoutes from "./routes/jobPermitCompanies";
import inspectionsRoutes from "./routes/inspections";
import jobInspectionsRoutes from "./routes/jobInspections";
import scheduledTasksRoutes from "./routes/scheduledTasks";
// ⚠️ TEMP: Postgres connectivity check
// DO NOT REMOVE until data migration is complete
import { Client } from "pg";

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
app.use("/api/tenant", tenantRoutes);
app.use("/api", jobRoutes);
app.use("/api/crews", crewsRoutes);
app.use("/api/contractors", contractorsRoutes);
app.use('/api/phase-groups', phaseGroupsRouter);
app.use("/api/vendors", vendorsRoutes);
app.use("/api/supervisors", supervisorsRoutes);
app.use("/api/jobs", jobCrewsRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/service-cases", serviceCasesRouter);
app.use("/api/jobs", jobSupervisorsRoutes);
app.use("/api/jobs", jobContractorsRoutes);
app.use("/api/jobs", jobVendorsRoutes);
app.use("/api/contractor-phase-notes", contractorPhaseNotes);
app.use("/api/jobs", jobDefaultsRoutes);
app.use("/api/permit-companies", permitCompaniesRoutes);
app.use("/api/jobs", jobPermitCompaniesRoutes);
app.use("/api/inspections", inspectionsRoutes);
app.use("/api/jobs", jobInspectionsRoutes);
app.use("/api/job-pdfs", jobPdfsRoutes);
app.use("/api/scheduled-tasks", scheduledTasksRoutes);
app.use("/api/materials", materialsRoutes);
app.use("/api/orders", ordersRouter);
app.use('/api/supervisor-phase-notes', supervisorPhaseNotes);
app.use("/api/tenant/users", tenantUsersRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/pdf-overlays", pdfOverlayRoutes);
// Templates (office / app only)
app.use("/api/templates", templateRoutes);
app.use("/api/phases", phasesRoutes);

const port = process.env.PORT ? Number(process.env.PORT) : 8787;

// 🔎 TEMP STARTUP CHECK — verifies DATABASE_URL works
(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL not set — Postgres disabled");
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query("select 1 as ok");
    console.log("✅ Postgres connected:", res.rows[0]);
  } catch (err) {
    console.error("❌ Postgres connection failed:", err);
  } finally {
    await client.end();
  }
})();

// 🔄 Run phase activation automation every 60 seconds
setInterval(() => {
  activateDuePhases();
}, 60 * 1000);


app.listen(port, "0.0.0.0", () => {
  // ⚠️ Startup verification
  // DO NOT REMOVE — ensures DB persistence works in production
  testPostgresConnection();

  console.log("🚀 Backend listening on port", port);

  // 📣 Start push scheduler
  startPushScheduler();
});
