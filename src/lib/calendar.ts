export function calendarWindow(day: string) {
  const [year, month] = day.split("-").map(Number);
  return { from: `${day.slice(0, 7)}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}
