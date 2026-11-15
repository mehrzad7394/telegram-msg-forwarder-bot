import { ActionForm } from "@/components/action-form";
import {
  Badge,
  Empty,
  Metric,
  PageHeading,
  Panel,
  StatusBadge,
} from "@/components/ui";
import { getPathname, Link } from "@/i18n/navigation";
import {
  activateAllSourceChannels,
  deactivateAllSourceChannels,
} from "@/lib/actions";
import { pageMetadata } from "@/lib/metadata";
import {
  getActiveSourceChannel,
  getSourceChannels,
  getSourceChannelStats,
} from "@/lib/queries";
import { Plus, Rss, Waypoints } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata() {
  return pageMetadata(
    "sourceChannel",
    "/sourceChannels",
    "sourceChannelsMetadata",
  );
}

export default async function SourceChannelsPage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const [channels, active, stats] = await Promise.all([
    getSourceChannels(),
    getActiveSourceChannel(),
    getSourceChannelStats(),
  ]);
  return (
    <div className="page-stack">
      <PageHeading
        label={t("receivingRoute")}
        title={t("channels")}
        description={t("sourceChannelDescription")}
        action={
          <div className="flex flex-col gap-1 md:flex-row">
            <Link className="button button-primary" href="/sourceChannels/new">
              <Plus size={18} />
              {t("addChannel")}
            </Link>
            {stats.active < stats.total && (
              <ActionForm
                action={activateAllSourceChannels}
                label={t("activateAll")}
                pendingLabel={t("activating")}
                confirm={t("activateAllConfirm")}
                variant="secondary"
                className="contents"
                showNotice={false}
              />
            )}
            {!!stats?.active && (
              <ActionForm
                action={deactivateAllSourceChannels}
                label={t("deactivateAll")}
                pendingLabel={t("deactivating")}
                confirm={t("deactivateAllConfirm")}
                variant="danger"
                className="inline"
                showNotice={false}
              />
            )}
          </div>
        }
      />
      <div className="grid-cols-1 metric-grid metric-three">
        <Metric
          label={t("registeredChannels")}
          value={stats.total}
          hint={t("allChannels")}
          icon={Rss}
        />
        <Metric
          label={t("activeChannels")}
          value={stats.active}
          hint={""}
          icon={Waypoints}
          tone="blue"
        />
      </div>
      <Panel title={t("channelsList")} subtitle={t("sourceChannelsListHelp")}>
        {channels.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            aria-label={t("channelsList")}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("channel")}</th>
                  <th scope="col">{t("telegramId")}</th>
                  <th scope="col">{t("status")}</th>
                  <th scope="col">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((channel) => (
                  <tr key={channel._id}>
                    <td>
                      <div className="cell-identity">
                        <span className="icon-tile tile-blue">
                          <Rss size={16} />
                        </span>
                        <bdi>{channel.channelName}</bdi>
                      </div>
                    </td>
                    <td>
                      <code dir="ltr">{channel.channelId}</code>
                    </td>
                    <td>
                      <StatusBadge active={channel.isActive} />
                    </td>
                    <td>
                      <a
                        className="text-link"
                        href={getPathname({
                          href: `/sourceChannels/${channel._id}`,
                          locale,
                        })}
                      >
                        {t("manage")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={Rss}
            title={t("channelsEmpty")}
            description={t("sourceChannelsEmptyHelp")}
          />
        )}
      </Panel>
    </div>
  );
}
