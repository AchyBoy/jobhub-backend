// JobHub/src/services/automationOffsets.ts
export function resolveOffset(base: Date, offset: string) {

  const d = new Date(base)

  if (offset === "day_of") return d

  if (offset === "3_days_before") {
    d.setDate(d.getDate() - 3)
    return d
  }

  if (offset === "7_days_after") {
    d.setDate(d.getDate() + 7)
    return d
  }

  return d
}