import { NextResponse } from 'next/server';
/** Retired: a shared PIN cannot establish the canonical human principal. */
export async function GET() { return NextResponse.json({error: 'Use authenticated account sign-in'}, {status: 410, headers: {'cache-control': 'no-store'}}); }
export const POST = GET;
