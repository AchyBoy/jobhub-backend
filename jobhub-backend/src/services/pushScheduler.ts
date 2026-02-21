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
  body: string
) {
  const tokenResult = await pool.query(
    `
    SELECT expo_push_token
    FROM push_tokens
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  if (tokenResult.rowCount === 0) return;

  const messages = tokenResult.rows.map((row) => ({
    to: row.expo_push_token,
    sound: "default",
    title,
    body,
  }));

  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
}

async function processThreeDayNotifications() {
  const result = await pool.query(
    `
    SELECT *
    FROM scheduled_tasks
    WHERE
      status = 'scheduled'
      AND three_day_notified_at IS NULL
      AND scheduled_at > NOW()
      AND scheduled_at <= NOW() + INTERVAL '3 days'
    `
  );

  for (const task of result.rows as ScheduledTask[]) {
    const timeFormatted = formatLocalTime(task.scheduled_at);

    const body = `${task.job_name ?? task.id} - ${task.phase} - ${
      task.crew_name ?? "Crew"
    } - ${timeFormatted}`;

    await sendPushToTenant(task.tenant_id, "Upcoming Task", body);

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
    const timeFormatted = formatLocalTime(task.scheduled_at);

    const body = `${task.job_name ?? task.id} - ${task.phase} - ${
      task.crew_name ?? "Crew"
    } - ${timeFormatted}`;

    await sendPushToTenant(task.tenant_id, "Upcoming Task", body);

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

  setInterval(async () => {
    try {
      await processThreeDayNotifications();
      await processOneHourNotifications();
    } catch (err) {
      console.error("Push scheduler error:", err);
    }
  }, 60_000);
}