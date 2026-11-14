import { SettingsInput } from "../types";

export function isListeningTime(settings: SettingsInput): boolean {
  const {
    listeningStartTime = "08:30",
    listeningEndTime = "22:00",
    timeZone = "Asia/Tehran",
  } = settings;

  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());

  if (listeningStartTime <= listeningEndTime) {
    return currentTime >= listeningStartTime && currentTime < listeningEndTime;
  }

  return currentTime >= listeningStartTime || currentTime < listeningEndTime;
}
