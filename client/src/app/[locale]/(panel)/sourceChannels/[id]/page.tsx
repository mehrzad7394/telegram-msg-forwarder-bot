import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { EntityButtons } from "@/components/entity-buttons";
import { SourceChannelForm } from "@/components/entity-forms";
import { PageHeading, Panel, StatusBadge } from "@/components/ui";
import { pageMetadata } from "@/lib/metadata";
import { getSourceChannel } from "@/lib/queries";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return pageMetadata(
    id === "new" ? "addChannel" : "manageChannel",
    `/sourceChannels/${encodeURIComponent(id)}`,
  );
}

export default async function SourceChannelPage({ params }: Props) {
  const t = await getTranslations();
  const { id } = await params;
  const [channel] =
    id === "new" ? [null, null] : await Promise.all([getSourceChannel(id)]);
  if (id !== "new" && !channel) notFound();
  return (
    <div className="page-stack">
      <PageHeading
        label={t("receivingRoute")}
        title={channel ? t("sourceChannelDescription") : t("addChannel")}
        description={
          channel
            ? t("sourceChannelEditDescription")
            : t("sourceChannelCreateDescription")
        }
        back={{ href: "/sourceChannels", label: t("backToSourceChannels") }}
        action={channel && <StatusBadge active={channel.isActive} />}
      />
      <div className="detail-grid">
        <Panel title={t("channelDetails")}>
          <SourceChannelForm key={id} channel={channel ?? undefined} />
        </Panel>
        {channel && (
          <Panel
            title={t("channelActions")}
            subtitle={t("sourceChannelActionsHelp")}
          >
            <div className="panel-body">
              <p className="detail-value">
                <bdi>{channel.channelName}</bdi>
                <code dir="ltr">{channel.channelId}</code>
              </p>
              <EntityButtons
                id={channel._id}
                buttons={[
                  {
                    command: channel.isActive
                      ? "deactiveSourceChannel"
                      : "activateSourceChannel",
                    label: channel.isActive ? t("deactivate") : t("setSource"),
                    confirm: t("setSourceConfirm"),
                  },
                  {
                    command: "deleteSourceChannel",
                    label: t("deleteChannel"),
                    danger: true,
                    confirm: t("deleteChannelConfirm"),
                  },
                ]}
              />
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
