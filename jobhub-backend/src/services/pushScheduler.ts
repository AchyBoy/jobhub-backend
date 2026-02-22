// jobhub-backend/src/services/pushScheduler.ts

import { pool } from "../db/postgres";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ScheduledTask = {
  id: string;
  tenant_id: string;
  job_name: string | null;
  phase: string;
  crew_name: string | null;
  scheduled_at: string;
};

function formatLocalTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function sendPushToTenant(
  tenantId: string,
  title: string,
  body: string,
  taskId: string
) {
  console.log("🔎 sendPushToTenant called for tenant:", tenantId);

  const tokenResult = await pool.query(
    `
    SELECT expo_push_token
    FROM push_tokens
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  console.log("🔎 Tokens found:", tokenResult.rowCount);

  if (tokenResult.rowCount === 0) {
    console.log("⚠️ No push tokens for tenant:", tenantId);
    return;
  }

const messages = tokenResult.rows.map((row) => ({
  to: row.expo_push_token,
  sound: "default",
  title,
  body,
  data: {
    screen: "schedule",
    taskId,
  },
}));

  console.log("📤 Sending push to Expo:", JSON.stringify(messages, null, 2));

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const data = await response.json();

  console.log("📨 Expo push response:", JSON.stringify(data, null, 2));
}

async function processThreeDayNotifications() {
  const result = await pool.query(
    `
    SELECT *
    FROM scheduled_tasks
WHERE
  status = 'scheduled'
  AND three_day_notified_at IS NULL
  AND one_hour_notified_at IS NULL
  AND scheduled_at > NOW() + INTERVAL '1 hour'
  AND scheduled_at <= NOW() + INTERVAL '3 days'
    `
  );

  for (const task of result.rows as ScheduledTask[]) {
    console.log("🔥 THREE DAY FIRING FOR", task.id);
    const timeFormatted = formatLocalTime(task.scheduled_at);

    const body = `${task.job_name ?? task.id} - ${task.phase} - ${
      task.crew_name ?? "Crew"
    } - ${timeFormatted}`;

    await sendPushToTenant(
  task.tenant_id,
  "Upcoming Task",
  body,
  task.id
);

    await pool.query(
      `
      UPDATE scheduled_tasks
      SET three_day_notified_at = NOW()
      WHERE id = $1
      `,
      [task.id]
    );
  }
}

async function processOneHourNotifications() {
  
  const result = await pool.query(
    `
    SELECT *
    FROM scheduled_tasks
    WHERE
      status = 'scheduled'
      AND one_hour_notified_at IS NULL
      AND scheduled_at > NOW()
      AND scheduled_at <= NOW() + INTERVAL '1 hour'
    `
  );

  for (const task of result.rows as ScheduledTask[]) {
    console.log("🔥 ONE HOUR FIRING FOR", task.id);
    const timeFormatted = formatLocalTime(task.scheduled_at);

    const body = `${task.job_name ?? task.id} - ${task.phase} - ${
      task.crew_name ?? "Crew"
    } - ${timeFormatted}`;

    await sendPushToTenant(
  task.tenant_id,
  "Upcoming Task",
  body,
  task.id
);

    await pool.query(
      `
      UPDATE scheduled_tasks
      SET one_hour_notified_at = NOW()
      WHERE id = $1
      `,
      [task.id]
    );
  }
}

export function startPushScheduler() {
  console.log("📣 Push scheduler started");

  // Prevent overlap inside a single Node process
  let running = false;

  // Global lock across ALL backend instances (local + Railway + anything)
  const LOCK_KEY = 424242; // any constant int is fine

  setInterval(async () => {
    if (running) return;
    running = true;

    const tick = new Date().toISOString();
    console.log("⏱ Scheduler tick", tick);

    let locked = false;

    try {
      // Try to become the leader
      const lockRes = await pool.query(
        `SELECT pg_try_advisory_lock($1) AS locked`,
        [LOCK_KEY]
      );

      locked = lockRes.rows?.[0]?.locked === true;

      if (!locked) {
        console.log("🔒 Scheduler skipped (another instance is leader)");
        return;
      }

      console.log("🔓 Scheduler leader acquired");

      await processThreeDayNotifications();
      await processOneHourNotifications();
    } catch (err) {
      console.error("Push scheduler error:", err);
    } finally {
      // Release leadership lock if we had it
      if (locked) {
        try {
          await pool.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY]);
          console.log("🔐 Scheduler leader released");
        } catch (e) {
          console.warn("⚠️ Failed to release advisory lock", e);
        }
      }

      running = false;
    }
  }, 60_000);
}