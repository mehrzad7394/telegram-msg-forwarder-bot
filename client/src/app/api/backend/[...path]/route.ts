import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const tokenCookie = 'relay_admin_token';

async function proxy(request: NextRequest, method: string) {
  const path = request.nextUrl.pathname.replace(/^\/api\/backend\/?/, '');
  const allowedMethods: Record<string, string[]> = {
    'auth/login': ['POST'], 'auth/logout': ['POST'], 'auth/profile': ['GET'], 'auth/setup-password': ['POST'],
    users: ['GET'], 'users/stats': ['GET'], 'channels': ['GET', 'POST'], 'channels/active': ['GET'], 'channels/stats': ['GET'],
    filters: ['GET', 'POST'], 'filters/active': ['GET'], 'queue/stats': ['GET'], 'queue/messages': ['GET'], 'queue/cleanup': ['POST'],
    setting: ['GET', 'PUT'], health: ['GET'],
  };
  const idRoute = path.match(/^(users|channels|filters)\/([^/]+)(?:\/(activate|deactivate|promote|demote|set-active))?$/);
  const knownMethod = allowedMethods[path]?.includes(method) || Boolean(idRoute && (
    idRoute[1] === 'users' && (idRoute[3] ? ['PUT'].includes(method) : ['GET', 'PUT', 'DELETE'].includes(method)) ||
    idRoute[1] === 'channels' && (idRoute[3] === 'set-active' ? method === 'PUT' : ['GET', 'PUT', 'DELETE'].includes(method)) ||
    idRoute[1] === 'filters' && (idRoute[3] ? method === 'PUT' : ['GET', 'PUT', 'DELETE'].includes(method))
  ));
  if (!knownMethod) return NextResponse.json({ message: 'Route not available' }, { status: 404 });
  const backend = process.env.BACKEND_API_URL || 'http://localhost:3001/api';
  const url = `${backend.replace(/\/$/, '')}/${path}${request.nextUrl.search}`;
  const cookieStore = await cookies();
  const token = cookieStore.get(tokenCookie)?.value;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const body = ['GET', 'HEAD'].includes(method) ? undefined : await request.text();
  let upstream: Response;
  try {
    upstream = await fetch(url, { method, headers, body, cache: 'no-store' });
  } catch {
    return NextResponse.json({ message: 'Backend is unavailable' }, { status: 502 });
  }

  const responseText = await upstream.text();
  let responseBody: unknown;
  try { responseBody = responseText ? JSON.parse(responseText) : null; }
  catch { responseBody = { message: responseText || 'Unexpected backend response' }; }

  if (path === 'users' || path.startsWith('users/')) {
    const redact = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(redact);
      if (typeof value !== 'object' || value === null) return value;
      const record = value as Record<string, unknown>;
      return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'passwordHash').map(([key, nested]) => [key, redact(nested)]));
    };
    responseBody = redact(responseBody);
  }

  if (path === 'auth/login' && method === 'POST' && upstream.ok && typeof responseBody === 'object' && responseBody !== null && 'access_token' in responseBody) {
    const login = responseBody as { access_token: string; user?: unknown };
    const response = NextResponse.json({ success: true, data: login.user });
    response.cookies.set(tokenCookie, login.access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24,
    });
    return response;
  }

  if (path === 'auth/logout' && method === 'POST' && upstream.ok) {
    const response = NextResponse.json(responseBody, { status: upstream.status });
    response.cookies.delete(tokenCookie);
    return response;
  }
  if (upstream.status === 401) cookieStore.delete(tokenCookie);
  return NextResponse.json(responseBody, { status: upstream.status });
}

export const GET = (request: NextRequest) => proxy(request, 'GET');
export const POST = (request: NextRequest) => proxy(request, 'POST');
export const PUT = (request: NextRequest) => proxy(request, 'PUT');
export const DELETE = (request: NextRequest) => proxy(request, 'DELETE');