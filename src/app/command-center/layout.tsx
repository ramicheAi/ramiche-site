import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireOwnerIdentity } from '@/lib/server/owner-identity';
import CommandCenterClient from './CommandCenterClient';

export const dynamic = 'force-dynamic';
export default async function CommandCenterLayout({children}: {children: React.ReactNode}) {
  const identity = await requireOwnerIdentity({headers: new Headers(await headers())});
  if (!identity.ok) redirect('/command-login');
  return <CommandCenterClient>{children}</CommandCenterClient>;
}
