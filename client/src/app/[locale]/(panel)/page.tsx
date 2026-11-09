import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  Activity,
  ArrowLeft,
  ListOrdered,
  RadioTower,
  Send,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { Badge, dateTime, Metric, MoreLink, Panel } from "@/components/ui";
import { MessagesTable, QueueChart } from "@/components/queue-view";
import {
  getActiveChannel,
  getActiveFilters,
  getBackendGreeting,
  getBackendHealth,
  getChannelStats,
  getMessages,
  getQueueStats,
  getUserStats,
} from "@/lib/queries";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  return pageMetadata("overview", "/", "overviewMetadata");
}

export default async function DashboardPage() {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const [
    queue,
    users,
    channels,
    destination,
    filters,
    messages,
    health,
    greeting,
  ] = await Promise.all([
    getQueueStats(),
    getUserStats(),
    getChannelStats(),
    getActiveChannel(),
    getActiveFilters(),
    getMessages(5),
    getBackendHealth().catch(() => null),
    getBackendGreeting().catch(() => null),
  ]);
  return (
    <div className="page-stack">
      <section className="dashboard-hero">
        <div className="hero-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <div>
            <Send size={46} strokeWidth={1.5} />
          </div>
          <i />
          <i />
        </div>
        <div className="hero-copy">
          <span className="eyebrow">
            <span />
            {t("systemOverview")}
          </span>
          <h1>{t("dashboardTitle")}</h1>
          <p>{t("dashboardDescription")}</p>
          <Link className="button hero-button" href="/queue">
            {t("viewQueue")}
            <ArrowLeft className="inline-arrow" size={17} />
          </Link>
        </div>
      </section>

      <div className="metric-grid">
        <Metric
          label={t("waitingMessages")}
          value={queue.waiting}
          hint={t("delayedJobCount", { count: queue.delayed })}
          icon={ListOrdered}
        />
        <Metric
          label={t("registeredChannels")}
          value={channels.total}
          hint={t("activeChannelCount", { count: channels.active })}
          icon={RadioTower}
          tone="blue"
        />
        <Metric
          label={t("activeFilters")}
          value={filters.length}
          hint={t("rulesInEffect")}
          icon={SlidersHorizontal}
          tone="amber"
        />
        <Metric
          label={t("activeUsers")}
          value={users.active}
          hint={t("outOfRegisteredUsers", { count: users.total })}
          icon={UsersRound}
          tone="green"
        />
      </div>

      <div className="dashboard-grid">
        <Panel title={t("queueBreakdown")} subtitle={t("queueBreakdownHelp")}>
          <QueueChart stats={queue} />
        </Panel>
        <Panel title={t("serviceStatus")} subtitle={t("apiAndDelivery")}>
          <div className="service-card">
            <div className="service-row">
              <span className="icon-tile tile-green">
                <Activity size={19} />
              </span>
              <div>
                <strong>{t("backend")}</strong>
                <small>
                  <bdi dir="ltr">
                    {greeting || health?.service || "Telegram Bot API"}
                  </bdi>
                </small>
              </div>
              <Badge tone={health?.status === "ok" ? "green" : "red"} dot>
                {health?.status === "ok" ? t("available") : t("unknown")}
              </Badge>
            </div>
            <div className="service-row">
              <span className="icon-tile tile-blue">
                <RadioTower size={18} />
              </span>
              <div>
                <strong>{t("destinationChannel")}</strong>
                <small dir="auto">
                  {destination?.channelName || t("noActiveChannel")}
                </small>
              </div>
              {destination && (
                <Badge tone={destination.botIsAdmin ? "green" : "amber"} dot>
                  {destination.botIsAdmin
                    ? t("botIsAdmin")
                    : t("noAdminAccess")}
                </Badge>
              )}
            </div>
            <div className="service-footer">
              <span>
                {t("lastCheck", { time: dateTime(format, health?.timestamp) })}
              </span>
              <MoreLink href="/channels">{t("channels")}</MoreLink>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title={t("latestMessages")}
        subtitle={t("latestFive")}
        action={<MoreLink href="/queue">{t("allMessages")}</MoreLink>}
      >
        <MessagesTable messages={messages} />
      </Panel>
    </div>
  );
}
