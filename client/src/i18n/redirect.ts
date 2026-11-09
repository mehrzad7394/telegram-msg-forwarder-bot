import 'server-only';
import { getLocale } from 'next-intl/server';
import { redirect } from './navigation';

export async function redirectInLocale(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}
