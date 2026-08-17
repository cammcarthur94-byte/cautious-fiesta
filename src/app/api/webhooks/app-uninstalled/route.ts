import { NextRequest, NextResponse } from 'next/server';
import { POST as handleAppUninstalled } from '../app_uninstalled/route';

export async function POST(req: NextRequest) {
  return handleAppUninstalled(req);
}
