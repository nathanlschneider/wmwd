import { NextResponse } from 'next/server';
import { clientSettingsService } from '../lib/rateLimit/ClientSettingsService';

export async function POST(): Promise<Response> {
  if (!process.env.ERROR_AWARE_KEY) {
    throw new Error('ERROR_AWARE_KEY not set');
  }

  try {
    // Ensure settings are loaded before accessing them
    if (
      (await clientSettingsService.shouldRefetch()) ||
      !clientSettingsService.getSettings()
    ) {
      await clientSettingsService.fetchSettings();
    }

    const settings = await clientSettingsService.getInitializedSettings();

    if (!settings) {
      throw new Error('Settings not initialized after fetch');
    }

    const status = {
      settings: settings,
    };

    return new NextResponse(JSON.stringify(status), { status: 200 });
  } catch (err) {
    console.error('Error in /status route:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
