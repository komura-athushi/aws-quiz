import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ログレベルをクライアントサイドに渡すためのヘッダーを追加
  const logLevel = process.env.LOG_LEVEL || 'INFO';
  
  // HTMLレスポンスの場合のみログレベルを注入
  if (request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/_next/static') === false) {
    response.headers.set('X-Log-Level', logLevel);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
