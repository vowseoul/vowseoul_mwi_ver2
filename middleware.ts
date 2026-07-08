import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    // Protect /admin routes except /admin/login
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
      const cookieStore = request.cookies
      if (!cookieStore) {
        return redirectLogin(request, pathname)
      }

      const allCookies = typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : []
      const hasAuthCookie = allCookies.some(
        (cookie) => cookie && cookie.name && cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
      )

      if (!hasAuthCookie) {
        return redirectLogin(request, pathname)
      }
    }
  } catch (err) {
    console.error('Middleware execution error:', err)
    // On error, let the request proceed to let next.js handle it or log it
  }

  return NextResponse.next()
}

function redirectLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL('/admin/login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*'],
}
