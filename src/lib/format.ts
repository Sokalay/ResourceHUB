export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatBytes(value: number | bigint | null | undefined) {
  if (value == null) return "-";
  const bytes = typeof value === "bigint" ? Number(value) : value;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function formatRelativeTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absMs < hour) return formatter.format(Math.round(diffMs / minute), "minute");
  if (absMs < day) return formatter.format(Math.round(diffMs / hour), "hour");
  if (absMs < month) return formatter.format(Math.round(diffMs / day), "day");
  if (absMs < year) return formatter.format(Math.round(diffMs / month), "month");
  return formatter.format(Math.round(diffMs / year), "year");
}
