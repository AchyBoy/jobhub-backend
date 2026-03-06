//JobHub/ jobhub-backend/src/routes/automationOffsets.ts
export function resolveOffset(
  baseDate: Date,
  offset: string
): Date {

  const d = new Date(baseDate);

  switch (offset) {

    case "same_day":
      return d;

    case "day_of":
      return d;

    case "3_days_before":
      d.setDate(d.getDate() - 3);
      return d;

    case "7_days_after":
      d.setDate(d.getDate() + 7);
      return d;

    default:
      return d;
  }
}