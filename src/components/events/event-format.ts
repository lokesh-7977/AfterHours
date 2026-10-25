/** Event times are shown in India Standard Time, matching the rest of the app. */
const TZ = "Asia/Kolkata";

const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const longDay = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });

export const eventDay = (iso: string) => day.format(new Date(iso));
export const eventLongDay = (iso: string) => longDay.format(new Date(iso));
export const eventTime = (iso: string) => time.format(new Date(iso));
