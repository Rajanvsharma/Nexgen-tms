import { NextRequest, NextResponse } from 'next/server';

// Hostnames that belong to our default deployment — skip tenant resolution
const OWN_HOSTS = ['nexgentms.vercel.app', 'localhost', '127.0.0.1'];

export async function middleware(req: NextRequest) {
  const host  = req.headers.get('host') || '';
  const hostname = host.split(':')[0];

  // Skip own deployment and all Vercel preview URLs
  const isOwn = OWN_HOSTS.includes(hostname) || hostname.endsWith('.vercel.app');
  if (isOwn) return NextResponse.next();

  // Resolve custom hostname → tenant via backend public endpoint
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://nexgen-tms-backend.onrender.com';
  let tenant: { organizationId: string; portalType: 'tms' | 'carrier'; name: string } | null = null;

  try {
    const r = await fetch(`${apiBase}/api/organization/resolve-domain?domain=${hostname}`, {
      next: { revalidate: 300 }, // cache 5 min on edge
    });
    if (r.ok) tenant = await r.json();
  } catch {
    // Unknown domain — fall through as normal
    return NextResponse.next();
  }

  if (!tenant) return NextResponse.next();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-org-id', tenant.organizationId);
  requestHeaders.set('x-tenant-portal-type', tenant.portalType);
  requestHeaders.set('x-tenant-name', tenant.name);

  const url = req.nextUrl.clone();

  if (tenant.portalType === 'carrier') {
    // Carrier domain — only /carrier/* and /carrier-login allowed
    const allowed = url.pathname.startsWith('/carrier') || url.pathname === '/carrier-login';
    if (!allowed) {
      url.pathname = '/carrier-login';
      return NextResponse.redirect(url, { headers: requestHeaders });
    }
  } else {
    // TMS domain — block carrier portal routes
    if (url.pathname.startsWith('/carrier')) {
      url.pathname = '/login';
      return NextResponse.redirect(url, { headers: requestHeaders });
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Skip static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
