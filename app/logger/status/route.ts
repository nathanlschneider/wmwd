import { NextResponse } from 'next/server';
import { clientSettingsService } from '../lib/rateLimit/ClientSettingsService';
import { ensureEnvVar, logError } from '../lib/shared';

export async function POST(): Promise<Response> {
  try {
    ensureEnvVar('ERROR_AWARE_KEY');

    const shouldRefetch = await clientSettingsService.shouldRefetch();
    const currentSettings = clientSettingsService.getSettings();

    if (shouldRefetch || !currentSettings) {
      await clientSettingsService.fetchSettings();
    }

    const settings = await clientSettingsService.getInitializedSettings();
    if (!settings) {
      throw new Error('Settings not initialized after fetch');
    }

    return new NextResponse(JSON.stringify({ settings }), { status: 200 });
  } catch (err) {
    logError('Error in /status route', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
