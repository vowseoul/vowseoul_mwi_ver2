import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * /admin/* 접근을 지킨다. 이전 middleware.ts 는 'sb-*-auth-token' 쿠키의
 * 존재 여부만 확인했다 — 서명/만료를 검증하지 않으니 아무 값이나 있으면
 * 통과했다. 여기서는 실제로 세션을 갱신·검증하고, profiles.role === 'ADMIN'
 * 까지 확인한다.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const { pathname } = request.nextUrl

  // /theme-lab 은 테마 렌더러를 손으로 확인하는 개발용 페이지다. 어디에서도
  // 링크되지 않지만 빌드에는 포함되므로, 프로덕션에서는 URL 을 직접 쳐도
  // 열리지 않도록 404 로 막는다.
  if (pathname.startsWith('/theme-lab') && process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  const isAdminRoute = pathname.startsWith('/admin') && pathname !== '/admin/login'

  if (!isAdminRoute) return response

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })

    // getUser() 는 매번 Supabase Auth 서버에 토큰을 검증한다 (getSession() 과 달리
    // 로컬 쿠키 값만 믿고 넘어가지 않음) — 만료/위조된 세션을 여기서 걸러낸다.
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return redirectToLogin(request, pathname)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // 등록된 직원이면 관리자 화면에 들어온다. 예전에는 ADMIN 만 통과시켜서
    // 디자이너 계정은 로그인은 되는데 아무 화면도 못 열었다.
    if (profileError || !profile?.role) {
      return redirectToLogin(request, pathname)
    }

    // 시스템 설정만 운영자 전용이다 — 서비스 오픈 여부·보관 정책·직원 계정처럼
    // 되돌리기 어려운 것들이 모여 있다. 화면에서도 메뉴를 감추지만(§app/admin/(dashboard)/layout.tsx),
    // 주소를 직접 치고 들어오는 경로는 여기서 막아야 한다.
    if (pathname.startsWith('/admin/settings') && profile.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  } catch (err) {
    console.error('Proxy auth check error:', err)
    return redirectToLogin(request, pathname)
  }

  return response
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL('/admin/login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*', '/theme-lab/:path*', '/theme-lab'],
}
