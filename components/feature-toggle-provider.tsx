"use client"

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function FeatureToggleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkFeatureOpen() {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'is_feature_open')
          .maybeSingle()

        if (error) {
          // 설정 레코드가 없거나 에러 시 기본적으로 기능은 오픈된 것으로 간주
          setIsOpen(true)
          return
        }

        if (data && data.value) {
          setIsOpen(!!data.value.open)
        } else {
          setIsOpen(true)
        }
      } catch (err) {
        console.error('Error checking feature toggle:', err)
        setIsOpen(true)
      }
    }

    checkFeatureOpen()
  }, [pathname])

  useEffect(() => {
    if (isOpen === false) {
      const isAllowedPath = 
        pathname.startsWith('/admin') ||
        pathname.startsWith('/invitation') ||
        pathname.startsWith('/api') ||
        pathname === '/ready'

      if (!isAllowedPath) {
        router.replace('/ready')
      }
    }
  }, [isOpen, pathname, router])

  const isAllowedPath = 
    pathname.startsWith('/admin') ||
    pathname.startsWith('/invitation') ||
    pathname.startsWith('/api') ||
    pathname === '/ready'

  // 만약 기능이 닫혀있고 허용되지 않은 경로면 화면 노출을 막아 깜빡임을 방지합니다.
  if (isOpen === false && !isAllowedPath) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">페이지로 이동 중...</div>
      </div>
    )
  }

  return <>{children}</>
}
