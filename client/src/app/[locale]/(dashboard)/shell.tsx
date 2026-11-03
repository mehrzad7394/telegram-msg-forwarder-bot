'use client';

import { useEffect, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Activity, Bot, Languages, LayoutDashboard, LogOut, Menu, Moon, Radio, Settings, SlidersHorizontal, Sun, Users, ListChecks } from 'lucide-react';
import { UiProvider, useAppTranslations, useUi } from '@/components/providers';
import { api } from '@/lib/api';

const navigation = [
  { key: 'overview', href: '/', icon: LayoutDashboard }, { key: 'users', href: '/users', icon: Users }, { key: 'channels', href: '/channels', icon: Radio }, { key: 'filters', href: '/filters', icon: SlidersHorizontal }, { key: 'queue', href: '/queue', icon: ListChecks }, { key: 'settings', href: '/settings', icon: Settings },
] as const;

function Shell({ children, profile }: { children: React.ReactNode; profile: { username: string } }) {
  const { t, language } = useAppTranslations();
  const { dark, setDark } = useUi();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);
  const signOut = async () => { try { await api('auth/logout', { method: 'POST' }); } finally { router.replace('/login'); } };

  const Sidebar = () => <aside className="flex h-full flex-col px-4 py-5">
    <Link href="/" className="flex items-center gap-3 px-3 pb-8"><span className="grid size-10 place-items-center rounded-xl text-white" style={{background:'var(--accent)'}}><Bot size={22}/></span><span><strong className="block text-lg">{t('brand')}</strong><small className="muted tracking-widest">{t('brandSub')}</small></span></Link>
    <p className="mb-2 px-3 text-[10px] font-bold tracking-[.16em] muted">{t('manage').toUpperCase()}</p>
    <nav className="space-y-1">{navigation.map(({key,href,icon:Icon}) => <Link key={href} href={href} aria-current={pathname===href?'page':undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${pathname===href?'font-semibold':''}`} style={{background:pathname===href?'var(--accent-soft)':'transparent',color:pathname===href?'var(--accent)':'var(--muted)'}}><Icon size={17}/>{t(key)}</Link>)}</nav>
    <div className="mt-auto rounded-2xl p-4" style={{background:'var(--bg)'}}><div className="flex items-center gap-2 text-xs font-semibold"><Activity size={15} style={{color:'var(--accent)'}}/>{t('apiHealth')}</div><p className="mt-2 text-xs muted">{t('botInfo')}</p></div>
  </aside>;

  return <div className="min-h-screen">
    {mobileOpen && <button aria-label={t('closeMenu')} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden"/>}
    <aside dir={language==='fa'?'rtl':'ltr'} className={`surface fixed z-50 inset-y-3 w-[250px] transition-transform lg:translate-x-0 ${language==='fa'?'end-3':'start-3'} ${mobileOpen?'translate-x-0':language==='fa'?'translate-x-[120%]':'-translate-x-[120%]'}`}><Sidebar/></aside>
    <div className={`min-h-screen ${language==='fa'?'lg:pe-[274px]':'lg:ps-[274px]'}`}>
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between gap-3 border-b px-4 sm:px-7" style={{background:'color-mix(in srgb, var(--bg) 88%, transparent)',borderColor:'var(--line)',backdropFilter:'blur(12px)'}}>
        <div className="flex items-center gap-3"><button className="icon-button lg:hidden" aria-label={t('menu')} onClick={()=>setMobileOpen(true)}><Menu size={18}/></button><div><p className="text-[11px] muted">{t('brand')}</p><h1 className="text-lg font-bold">{t(navigation.find(item=>item.href===pathname)?.key ?? 'overview')}</h1></div></div>
        <div className="flex items-center gap-2"><button className="icon-button" aria-label={t('language')} title={t('language')} onClick={()=>router.replace(pathname,{locale:language==='en'?'fa':'en'})}><Languages size={17}/><span className="ms-1 text-[10px]">{language.toUpperCase()}</span></button><button className="icon-button" aria-label={t('theme')} title={t('theme')} onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><div className="hidden h-8 w-px sm:block" style={{background:'var(--line)'}}/><div className="hidden text-end sm:block"><p className="text-xs font-semibold">{profile.username}</p><p className="text-[10px] muted">{t('admin')}</p></div><button className="icon-button" aria-label={t('signOut')} title={t('signOut')} onClick={signOut}><LogOut size={17}/></button></div>
      </header>
      <main className="mx-auto max-w-[1500px] p-4 sm:p-7">{children}</main>
    </div>
  </div>;
}

export default function DashboardShell({children,profile}:{children:React.ReactNode;profile:{username:string}}) { return <UiProvider><Shell profile={profile}>{children}</Shell></UiProvider>; }