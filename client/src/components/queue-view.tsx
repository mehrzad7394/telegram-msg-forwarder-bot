import { useFormatter, useTranslations } from "next-intl";
import type { MessageRecord, QueueStats } from "@repo/shared";
import { ListOrdered } from "lucide-react";
import { Badge, dateTime, Empty } from "./ui";

export const queueStates = [
  { key: "waiting", label: "waiting", color: "var(--purple)" },
  { key: "active", label: "processing", color: "#4d94ed" },
  { key: "completed", label: "completed", color: "#1aab7d" },
  { key: "failed", label: "failed", color: "#ec6682" },
  { key: "delayed", label: "delayed", color: "#e6a74e" },
] as const;

const messageStates = {
  queued: ["queued", "purple"],
  processing: ["processing", "amber"],
  sent: ["sent", "green"],
  failed: ["failed", "red"],
} as const;

export function QueueChart({ stats }: { stats: QueueStats }) {
  const t = useTranslations();
  const format = useFormatter();
  const total = queueStates.reduce((sum, { key }) => sum + stats[key], 0);
  const stops: string[] = [];
  let start = 0;
  if (total) {
    for (const { key, color } of queueStates) {
      if (!stats[key]) continue;
      const end = start + (stats[key] / total) * 100;
      stops.push(`${color} ${start}% ${end}%`);
      start = end;
    }
  }
  return (
    <div className="queue-chart">
      <div
        className="queue-ring"
        style={{
          background: stops.length
            ? `conic-gradient(${stops.join(", ")})`
            : "#eeeaf8",
        }}
      >
        <div>
          <strong>{format.number(total)}</strong>
          <span>{t("totalQueueJobs")}</span>
        </div>
      </div>
      <ul className="queue-legend">
        {queueStates.map(({ key, label, color }) => (
          <li key={key}>
            <i style={{ background: color }} aria-hidden="true" />
            <span>{t(label)}</span>
            <b>{format.number(stats[key])}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MessagesTable({
  messages,
  expandable = false,
}: {
  messages: MessageRecord[];
  expandable?: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();
  if (!messages.length)
    return (
      <Empty
        icon={ListOrdered}
        title={t("messageHistoryEmpty")}
        description={t("messageHistoryEmptyHelp")}
      />
    );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      aria-label={t("messageHistoryTable")}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">{t("message")}</th>
            <th scope="col">{t("sender")}</th>
            <th scope="col">{t("status")}</th>
            <th scope="col">{t("createdAt")}</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((message) => {
            const sender =
              typeof message.userId === "string"
                ? message.userId
                : message.userId?.username || message.userId?.telegramId || "—";
            const [label, tone] =
              messageStates[message.status] ??
              (["unknown", "neutral"] as const);
            return (
              <tr key={message._id}>
                <td className="message-cell">
                  {expandable ? (
                    <details>
                      <summary>
                        <bdi className="message-preview">
                          {message.processedMessage || message.originalMessage}
                        </bdi>
                      </summary>
                      <div className="message-detail">
                        <p>{t("originalText")}</p>
                        <pre dir="auto">{message.originalMessage}</pre>
                        <p>{t("processedText")}</p>
                        <pre dir="auto">{message.processedMessage}</pre>
                        {message.sentAt && (
                          <small>
                            {t("sentAt", {
                              time: dateTime(format, message.sentAt),
                            })}
                          </small>
                        )}
                        {message.error && (
                          <>
                            <p>{t("deliveryErrorDetails")}</p>
                            <pre dir="auto">{message.error}</pre>
                          </>
                        )}
                      </div>
                    </details>
                  ) : (
                    <bdi className="message-preview">
                      {message.processedMessage || message.originalMessage}
                    </bdi>
                  )}
                </td>
                <td>
                  <bdi>{sender}</bdi>
                </td>
                <td>
                  <Badge tone={tone} dot>
                    {t(label)}
                  </Badge>
                </td>
                <td className="nowrap">
                  {dateTime(format, message.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
