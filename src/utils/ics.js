// Builds a tiny .ics calendar file for the monthly payday reminder. Pure, so
// it can be tested; the UI turns the string into a download.

const pad = (n) => String(n).padStart(2, '0');
const dateStamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// RFC 5545: escape \ ; , and newlines in text values
const escText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// RFC 5545: lines longer than 75 octets continue on the next line after a space
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** The next payday on or after `from`. `day` is 1–28 or 'last'. */
export function nextPayday(day, from = new Date()) {
  const y = from.getFullYear();
  const m = from.getMonth();
  const on = (yy, mm) => (day === 'last' ? new Date(yy, mm + 1, 0) : new Date(yy, mm, day));
  const thisMonth = on(y, m);
  const today = new Date(y, m, from.getDate());
  return thisMonth >= today ? thisMonth : on(y, m + 1);
}

/** A monthly 9 am reminder on payday, with the plan's steps as its notes. */
export function paydayIcs({ day, title, lines, now = new Date() }) {
  const start = nextPayday(day, now);
  const rule = `FREQ=MONTHLY;BYMONTHDAY=${day === 'last' ? -1 : day}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Household Budget Optimizer//Payday reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:payday-${now.getTime()}@budget-optimizer`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${dateStamp(start)}T090000`,
    `DTEND:${dateStamp(start)}T091500`,
    `RRULE:${rule}`,
    `SUMMARY:${escText(title)}`,
    `DESCRIPTION:${escText(lines.join('\n'))}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escText(title)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].map(fold).join('\r\n');
}
