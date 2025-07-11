import { LogReceiver } from '@erroraware/client';
import * as fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import {
  createErrorResponse,
  createRequestContext,
  home,
  MAX_BODY_SIZE,
  objectProperyRemover,
  securityHeaders,
  signPayload,
} from './lib/shared';
import {
  checkContentLength,
  checkHTTPS,
  ensureEnvVar,
  logError,
  authorizeRequest,
} from './lib/shared';
import type { ResJsonType } from './lib/types';
import * as zlib from 'zlib';

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRequestContext(req);
  const originalString = Buffer.from(
    ensureEnvVar('ERROR_AWARE_KEY'),
    'base64'
  ).toString('utf8');
  const [validationId] = originalString.split(':');

  if (!authorizeRequest(req, validationId)) {
    return createErrorResponse('Unauthorized', 401);
  }

  if (!checkContentLength(req, MAX_BODY_SIZE)) {
    return createErrorResponse('Request too large', 413);
  }

  if (!checkHTTPS(req)) {
    return createErrorResponse('HTTPS required');
  }

  try {
    const res = await LogReceiver(req);
    const resJson: ResJsonType = await res.json();

    if (resJson.error) {
      return createErrorResponse(resJson.error, 400);
    }

    const parsedLog = JSON.parse(resJson.logData);
    const system = parsedLog.type === 'request' ? 'request' : 'app';

    await fs.promises.mkdir(`${home}/errorlogs/${system}`, {
      recursive: true,
    });

    const currentDate = new Date();
    const formattedDate = `${(currentDate.getMonth() + 1)
      .toString()
      .padStart(2, '0')}${currentDate
      .getDate()
      .toString()
      .padStart(2, '0')}${currentDate.getFullYear()}`;

    const logData = JSON.stringify(objectProperyRemover(parsedLog, ['id']));

    await fs.promises.appendFile(
      `${home}/errorlogs/${system}/${formattedDate}.log`,
      logData + '\n',
      'utf8'
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Log data appended successfully',
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      {
        status: 200,
        headers: {
          'X-Request-ID': context.requestId,
          'X-Correlation-ID': context.correlationId,
          ...securityHeaders,
        },
      }
    );
  } catch (error) {
    logError('Failed to process POST /logger', error);
    return createErrorResponse('Bad Request', 400);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const context = createRequestContext(req);

  const originalString = Buffer.from(
    ensureEnvVar('ERROR_AWARE_KEY'),
    'base64'
  ).toString('utf8');
  const [validationId] = originalString.split(':');

  if (!authorizeRequest(req, validationId)) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const type = url.searchParams.get('type');
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const allowedTypes = ['request', 'app'];

    if (!type || !allowedTypes.includes(type)) {
      return createErrorResponse('Invalid type parameter', 400);
    }

    const lines = Number(url.searchParams.get('lines') ?? 100);
    const start = Number(url.searchParams.get('start') ?? 0);

    if (!date || !/^\d{8}$/.test(date)) {
      return createErrorResponse('Invalid date format. Use MMDDYYYY', 400);
    }

    const logPath = `${home}/errorlogs/${type}/${date}.log`;

    try {
      const logContent = await fs.promises.readFile(logPath, 'utf-8');
      let logLines = logContent.split('\n');

      if (search) {
        logLines = logLines.filter((line) =>
          line.toLowerCase().includes(search)
        );
      }

      const totalLines = logLines.length;
      const logSlice = logLines.slice(start, start + lines);

      const responsePayload = {
        content: logSlice.join('\n'),
        lines,
        start,
        totalLines,
        timestamp: Date.now(),
        requestId: context.requestId,
        type,
        date,
      };

      const signature = signPayload(responsePayload);
      const fullResponse = JSON.stringify({
        success: true,
        payload: responsePayload,
        signature,
        requestId: context.requestId,
        correlationId: context.correlationId,
      });

      const acceptEncoding = req.headers.get('accept-encoding') || '';
      const supportsBrotli = acceptEncoding.includes('br');
      const supportsGzip = acceptEncoding.includes('gzip');

      let body: Buffer;
      let encoding: string | undefined;

      if (supportsBrotli) {
        body = zlib.brotliCompressSync(fullResponse);
        encoding = 'br';
      } else if (supportsGzip) {
        body = zlib.gzipSync(fullResponse);
        encoding = 'gzip';
      } else {
        body = Buffer.from(fullResponse, 'utf8');
      }

      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': context.requestId,
          'X-Correlation-ID': context.correlationId,
          'X-Signature-Type': 'RSA-SHA256',
          ...(encoding ? { 'Content-Encoding': encoding } : {}),
          ...securityHeaders,
        },
      });
    } catch (error) {
      logError('Log file not found', error);
      return createErrorResponse('Log file not found', 404);
    }
  } catch (error) {
    logError('Failed to process GET /logger', error);
    return createErrorResponse('Internal Server Error', 500);
  }
}
