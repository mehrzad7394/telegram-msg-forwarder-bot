import { LanguageSwitch } from '@/components/language-switch';
import { getTranslations } from 'next-intl/server';
import { redirectInLocale } from '@/i18n/redirect';
import { ArrowDownLeft, Fingerprint, RadioTower, Send, SlidersHorizontal } from 'lucide-react';
import { ActionForm, Field } from '@/components/action-form';
import { Brand } from '@/components/ui';
import { login } from '@/lib/actions';
import { getSession } from '@/lib/session';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  return pageMetadata('signInMetadataTitle', '/login', 'signInMetadata');
}

export default async function LoginPage() {
  const t = await getTranslations();
  const profile = await getSession().catch(() => null);
  if (profile) return redirectInLocale('/');
  return (
    <main className="login-page">
      <section className="login-main">
        <div className="login-toolbar"><Brand /><LanguageSwitch /></div>
        <div className="login-form">
          <span className="icon-tile"><Fingerprint size={23} /></span>
          <span className="eyebrow"><span />{t('adminAccess')}</span>
          <h1>{t('signInTitle')}</h1>
          <p>{t('loginDescription')}</p>
          <ActionForm action={login} label={t('signIn')} pendingLabel={t('signingIn')}>
            <Field label={t('username')}><input name="username" autoComplete="username" dir="ltr" required /></Field>
            <Field label={t('password')}><input name="password" type="password" autoComplete="current-password" dir="ltr" required /></Field>
          </ActionForm>
        </div>
        <div className="login-footer"><span>{t('adminLoginFooter')}</span><span dir="ltr">Relay Console</span></div>
      </section>
      <aside className="login-art" aria-label={t('consoleIntroduction')}>
        <div className="login-art-label"><span />{t('telegramWorkspace')}</div>
        <div className="login-diagram" aria-hidden="true">
          <div className="diagram-orbit orbit-one" /><div className="diagram-orbit orbit-two" /><div className="diagram-orbit orbit-three" />
          <div className="diagram-center"><Send size={56} strokeWidth={1.6} /></div>
          <div className="diagram-node diagram-node-a"><RadioTower size={24} /></div>
          <div className="diagram-node diagram-node-b"><SlidersHorizontal size={23} /></div>
          <div className="diagram-node diagram-node-c"><ArrowDownLeft size={23} /></div>
        </div>
        <div className="login-art-copy"><h2>{t('loginArtworkTitle')}</h2><p>{t('loginArtworkDescription')}</p></div>
      </aside>
    </main>
  );
}
