import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardShell from './shell';

type ProfileResponse = { success: boolean; data: { username: string } };

async function getProfile(token: string): Promise<ProfileResponse['data'] | null> {
  const backend = process.env.BACKEND_API_URL || 'http://localhost:3001/api';
  try {
    const response = await fetch(`${backend.replace(/\/$/, '')}/auth/profile`, {
      headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = await response.json() as ProfileResponse;
    return body.data ?? null;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get('relay_admin_token')?.value;
  if (!token) redirect('/login');
  const profile = await getProfile(token);
  if (!profile) redirect('/login');
  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}