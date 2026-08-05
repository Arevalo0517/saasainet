import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const WIDGET_PATH = join(process.cwd(), '..', 'widget', 'dist', 'index.global.js');

const streamFile = (req: NextRequest, buf: Buffer): Response => {
  const range = req.headers.get('range');
  if (range !== null) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match !== null) {
      const start = match[1] === '' ? 0 : Number(match[1]);
      const end = match[2] === '' ? buf.length - 1 : Number(match[2]);
      if (start < buf.length && end < buf.length && start <= end) {
        const chunk = buf.subarray(start, end + 1);
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${start}-${end}/${buf.length}`,
            'Cache-Control': 'public, max-age=300, s-maxage=300',
          },
        });
      }
    }
  }
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Length': String(buf.length),
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
};

export const GET = async (req: NextRequest): Promise<Response> => {
  try {
    await stat(WIDGET_PATH);
  } catch {
    return new NextResponse(
      `// widget bundle missing: run 'pnpm --filter @platform/widget build'\nconsole.error('[platform] widget bundle not built at', ${JSON.stringify(WIDGET_PATH)});`,
      { status: 503, headers: { 'Content-Type': 'application/javascript; charset=utf-8' } },
    );
  }
  const buf = await readFile(WIDGET_PATH);
  return streamFile(req, buf);
};

