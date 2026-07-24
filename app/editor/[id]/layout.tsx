'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { EditorPreview } from '@/components/invitation/editor-preview'
import { useAppStore, sampleThemes } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Logo } from '@/components/logo'

const editorSteps = [
  { id: 1, name: '기본정보', path: '' },
  { id: 2, name: '디자인', path: '/design' },
  { id: 3, name: '콘텐츠', path: '/content' },
  { id: 4, name: '부가기능', path: '/features' },
  { id: 5, name: '결제/발행', path: '/payment' },
]

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const { currentInvitation, setCurrentInvitation, loadInvitation, saveInvitation, editorStep, setEditorStep, fetchData, isAuthenticated } = useAppStore()
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)

  const invitationId = params.id as string
  const basePath = `/editor/${invitationId}`

  // Show auth prompt for guests on new draft
  useEffect(() => {
    if (invitationId === 'new') {
      const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setIsAuthDialogOpen(true)
        }
      }
      checkSession()
    }
  }, [invitationId])

  // Initialize or load invitation on mount
  useEffect(() => {
    const initInvitation = async () => {
      // Load global database data (including themes) first
      await fetchData()

      const current = useAppStore.getState().currentInvitation

      if (invitationId === 'new') {
        // If there is no current invitation, or its id is not 'new' (excluding updated unsaved UUIDs)
        if (!current || (current.id !== 'new' && !current.id?.includes('__'))) {
          const { themes } = useAppStore.getState()
          const defaultTheme = (themes && themes.length > 0) ? themes[0] : sampleThemes[0]
          
          setCurrentInvitation({
            id: 'new',
            themeId: defaultTheme.id,
            colorSet: defaultTheme.colorSets?.[0]?.id || 'default',
            fontSet: defaultTheme.fontSets?.[0]?.id || 'default',
            galleryViewType: 'slide',
            rsvpEnabled: true,
            rsvpMealEnabled: true,
            rsvpCommentEnabled: true,
            guestbookType: 'text',
            bankAccounts: [],
            contacts: [],
            galleryImages: [],
          })
        }
      } else {
        if (!current || current.id !== invitationId) {
          await loadInvitation(invitationId)
        }
      }
    }
    initInvitation()
  }, [invitationId, setCurrentInvitation, loadInvitation, fetchData])

  const handleSave = async () => {
    if (!isAuthenticated) {
      setIsAuthDialogOpen(true)
      return
    }

    const savedId = await saveInvitation()
    if (savedId) {
      alert('청첩장이 성공적으로 저장되었습니다!')
      if (invitationId === 'new') {
        router.push(`/editor/${savedId}`)
      }
    } else {
      alert('저장 중 오류가 발생했습니다.')
    }
  }

  // Update step based on pathname
  useEffect(() => {
    const currentPath = pathname.replace(basePath, '')
    const step = editorSteps.find(s => s.path === currentPath)
    if (step) {
      setEditorStep(step.id)
    }
  }, [pathname, basePath, setEditorStep])

  return (
    <div className="flex min-h-screen flex-col">
      {/* Editor Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back()
                } else {
                  router.push('/admin/invitations')
                }
              }}
              title="이전 화면으로 돌아가기"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">뒤로가기</span>
            </Button>
            <Logo className="h-4.5 w-auto text-foreground" />
          </div>

          {/* Step Indicator */}
          <nav className="hidden md:flex">
            <ol className="flex items-center gap-2">
              {editorSteps.map((step, index) => {
                const isActive = editorStep === step.id
                const isCompleted = editorStep > step.id
                return (
                  <li key={step.id} className="flex items-center">
                    <Link
                      href={`${basePath}${step.path}`}
                      className={cn(
                        'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                        isActive && 'bg-foreground text-background',
                        isCompleted && 'text-foreground',
                        !isActive && !isCompleted && 'text-muted-foreground'
                      )}
                    >
                      <span className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                        isActive && 'bg-background text-foreground',
                        isCompleted && 'bg-foreground text-background',
                        !isActive && !isCompleted && 'border border-current'
                      )}>
                        {isCompleted ? <Check className="h-3 w-3" /> : step.id}
                      </span>
                      {step.name}
                    </Link>
                    {index < editorSteps.length - 1 && (
                      <div className={cn(
                        'mx-2 h-px w-8',
                        isCompleted ? 'bg-foreground' : 'bg-border'
                      )} />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>

          <Button onClick={handleSave}>
            저장하기
          </Button>
        </div>

        {/* Mobile Step Indicator */}
        <div className="flex border-t border-border md:hidden">
          {editorSteps.map((step) => {
            const isActive = editorStep === step.id
            return (
              <Link
                key={step.id}
                href={`${basePath}${step.path}`}
                className={cn(
                  'flex-1 py-2 text-center text-xs',
                  isActive ? 'border-b-2 border-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {step.name}
              </Link>
            )
          })}
        </div>
      </header>

      {/* Editor Content */}
      <div className="flex flex-1">
        {/* Left Panel - Form */}
        <div className="flex-1 overflow-auto p-6 pb-24 lg:p-8 lg:pb-32">
          <div className="mx-auto max-w-2xl">
            {children}
          </div>
        </div>

        {/* Right Panel - Preview */}
        {editorStep !== 5 && (
          <div className="hidden w-[400px] border-l border-border bg-muted/30 p-6 lg:block">
            <EditorPreview />
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">로그인 및 회원가입 안내</DialogTitle>
            <DialogDescription className="pt-2 text-sm text-muted-foreground leading-relaxed">
              VOW SEOUL 청첩장을 저장하고 최종 발행하려면 로그인이 필요합니다.
              <br />
              현재 작성 중인 정보는 안전하게 임시 저장되며, 로그인 및 회원가입 진행 후 작성하시던 단계에서 자동으로 연동되어 이어서 편집하실 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsAuthDialogOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              비회원으로 계속 작성
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined' && currentInvitation) {
                  localStorage.setItem('vow_seoul_draft_invitation', JSON.stringify(currentInvitation))
                }
                router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
              }}
            >
              로그인
            </Button>
            <Button
              onClick={() => {
                if (typeof window !== 'undefined' && currentInvitation) {
                  localStorage.setItem('vow_seoul_draft_invitation', JSON.stringify(currentInvitation))
                }
                router.push(`/signup?redirect=${encodeURIComponent(pathname)}`)
              }}
            >
              회원가입
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
