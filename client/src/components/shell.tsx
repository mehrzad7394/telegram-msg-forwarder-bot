"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitch } from "./language-switch";
import { useState, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Activity,
  ChevronLeft,
  ListOrdered,
  LayoutDashboard,
  LogOut,
  Menu,
  RadioTower,
  Settings2,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import type { AuthProfile } from "@repo/shared";
import { logout } from "@/lib/actions";
import { Brand } from "./ui";

const navigation = [
  { href: "/", label: "overview", icon: LayoutDashboard },
  { href: "/channels", label: "channels", icon: RadioTower },
  { href: "/filters", label: "filters", icon: SlidersHorizontal },
  { href: "/queue", label: "messageQueue", icon: ListOrdered },
  { href: "/users", label: "users", icon: UsersRound },
  { href: "/settings", label: "settings", icon: Settings2 },
] as const;

export function Shell({
  profile,
  children,
}: {
  profile: AuthProfile;
  children: ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = navigation.find(({ href }) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/"),
  );
  return (
    <div className="shell">
      {menuOpen && (
        <button
          type="button"
          className="nav-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label={t("closeMenu")}
        />
      )}
      <aside
        id="side-nav"
        className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
      >
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="sidebar-brand"
        >
          <Brand />
        </Link>
        <div className="workspace">
          <span className="workspace-icon">
            <Activity size={17} />
          </span>
          <div>
            <b>{t("adminWorkspace")}</b>
            <small>{t("telegramForwarder")}</small>
          </div>
        </div>
        <nav aria-label={t("consoleMenu")}>
          <p className="nav-label">{t("workspace")}</p>
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active?.href === href ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{t(label)}</span>
              {active?.href === href && (
                <ChevronLeft className="nav-indicator inline-arrow" size={15} />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            className="sidebar-profile"
          >
            <span className="avatar">
              {profile.username.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <b dir="auto">{profile.username}</b>
              <small>{t("systemAdmin")}</small>
            </span>
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="icon-button sidebar-logout"
              aria-label={t("signOut")}
              title={t("signOut")}
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className="shell-content">
        <a href="#main-content" className="skip-link">
          {t("skipToContent")}
        </a>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              type="button"
              className="icon-button mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
              aria-expanded={menuOpen}
              aria-controls="side-nav"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link href="/">{t("workspace")}</Link>
            <ChevronLeft className="inline-arrow" size={13} />
            <strong>{t(active?.label ?? "console")}</strong>
          </div>
          <div className="topbar-actions">
            <LanguageSwitch />
            <Link href="/settings" className="top-account">
              <span className="avatar">
                {profile.username.slice(0, 2).toUpperCase()}
              </span>
              <b dir="auto">{profile.username}</b>
            </Link>
          </div>
        </header>
        <main className="main-content" id="main-content">
          {children}
        </main>
        <footer className="footer">
          <span>{t("consoleFooter")}</span>
          <span>
            <bdi dir="ltr" lang="en">
              Relay Console
            </bdi>{" "}
            / {t("admin")}
          </span>
        </footer>
      </div>
    </div>
  );
}
