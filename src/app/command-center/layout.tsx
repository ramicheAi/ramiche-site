import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireOwnerIdentity } from '@/lib/server/owner-identity';
import CommandCenterClient from './CommandCenterClient';
import { cockpitMetadata } from '@/lib/server/cockpit-metadata';

export const metadata = cockpitMetadata('Parallax OS');

export const dynamic = 'force-dynamic';
export default async function CommandCenterLayout({children}: {children: React.ReactNode}) {
  const identity = await requireOwnerIdentity({headers: new Headers(await headers())});
  if (!identity.ok) redirect('/command-login');
  return <CommandCenterClient>{children}</CommandCenterClient>;
}
