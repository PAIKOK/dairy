/** Calendar dates are strings, never timestamps. Arithmetic is UTC; today uses a chosen zone. */
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export function validDate(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y,m,d] = key.split('-').map(Number) as [number,number,number];
  return y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y,m-1);
}
export const dateKey = (year: number, month: number, day: number) => `${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year,month+1,0)).getUTCDate();
export function shiftDate(key: string, amount: number): string {
  if (!validDate(key)) throw new Error('Invalid calendar date.');
  const [y,m,d] = key.split('-').map(Number) as [number,number,number];
  const result = new Date(Date.UTC(y,m-1,d+amount));
  return dateKey(result.getUTCFullYear(),result.getUTCMonth(),result.getUTCDate());
}
export function monthGrid(year: number, month: number, weekStart = 1): (string|null)[] {
  const before = (new Date(Date.UTC(year,month,1)).getUTCDay()-weekStart+7)%7;
  const grid: (string|null)[] = Array(before).fill(null);
  for(let d=1;d<=daysInMonth(year,month);d++) grid.push(dateKey(year,month,d));
  while(grid.length%7) grid.push(null);
  return grid;
}
export function todayInZone(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = (type: string) => parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validZone(zone: string): boolean { try { new Intl.DateTimeFormat('en',{timeZone:zone}).format(); return true; } catch { return false; } }
export function formatDate(key: string, options: Intl.DateTimeFormatOptions = { month:'long',day:'numeric',year:'numeric' }): string {
  if(!validDate(key)) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(`${key}T12:00:00Z`));
}
export function yearDates(year: number): string[] { return MONTHS.flatMap((_,m)=>Array.from({length:daysInMonth(year,m)},(_,i)=>dateKey(year,m,i+1))); }
