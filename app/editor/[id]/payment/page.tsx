'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAppStore, sampleThemes } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CreditCard, Copy, Check, ExternalLink, Calendar, Heart, Award, ArrowUpRight } from 'lucide-react'
import { MobilePreview } from '@/components/mobile-preview'

function Confetti() {
  const [particles, setParticles] = useState<any[]>([])

  useEffect(() => {
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#ff7849', '#ffc82c']
    const newParticles = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100 + '%',
      delay: Math.random() * 3 + 's',
      duration: Math.random() * 2 + 2 + 's',
      size: Math.random() * 8 + 6 + 'px',
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.5 ? 'circle' : 'square',
      rotate: Math.random() * 360 + 'deg',
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-p {
          position: absolute;
          top: -20px;
          animation-name: confetti-fall;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }
      `}} />
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-p"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '0%',
            transform: `rotate(${p.rotate})`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  )
}

export default function PaymentPage() {
  const router = useRouter()
  const params = useParams()
  const { currentInvitation, updateCurrentInvitation, saveInvitation, user } = useAppStore()
  const invitationId = params.id as string
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const theme = sampleThemes.find(t => t.id === currentInvitation?.themeId) || sampleThemes[0]
  const colorSet = theme.colorSets.find(c => c.id === currentInvitation?.colorSet) || theme.colorSets[0]
  
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const publishedUrl = `${origin || 'http://localhost:3000'}/invitation/${invitationId}`

  const handleBack = () => {
    router.push(`/editor/${invitationId}/features`)
  }

  const handlePayment = async () => {
    setIsProcessing(true)
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    try {
      // 1. Update invitation status & url
      updateCurrentInvitation({ status: 'published', publishedUrl })
      const savedId = await saveInvitation()
      if (!savedId) throw new Error('청첩장 저장 실패')

      // 2. Generate an order ID
      const userId = user?.id || 'anonymous'
      const randId = typeof window !== 'undefined' && window.crypto?.randomUUID 
        ? window.crypto.randomUUID() 
        : 'ord-' + Math.random().toString(36).substring(2, 15)
      const orderId = `${userId}__${randId}`

      // 3. Insert order into the database
      const orderData = {
        id: orderId,
        invitationId: savedId,
        customerName: user?.user_metadata?.name || currentInvitation?.groomName || '고객',
        groomName: currentInvitation?.groomName || '',
        brideName: currentInvitation?.brideName || '',
        weddingDate: currentInvitation?.weddingDate || '',
        theme: theme?.name || '',
        amount: 50000,
        status: 'deployed',
        createdAt: new Date().toISOString().split('T')[0],
        notes: ''
      }

      const { error } = await supabase.from('orders').insert(orderData)
      if (error) throw error

      setIsProcessing(false)
      setIsPaid(true)
      setIsPaymentOpen(false)
      setIsSuccessDialogOpen(true)
    } catch (err) {
      console.error('Payment processing failed:', err)
      alert('결제 처리 중 오류가 발생했습니다.')
      setIsProcessing(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publishedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('URL 복사에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">결제 및 발행</h1>
        <p className="mt-1 text-muted-foreground">
          최종 시안을 확인하고 결제를 진행해주세요.
        </p>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">최종 시안 미리보기</CardTitle>
          <CardDescription>완성된 청첩장을 확인해주세요.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-4">
          <MobilePreview isSticky={false} />
        </CardContent>
      </Card>

      {/* Payment Info */}
      {!isPaid ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">결제 정보</CardTitle>
            <CardDescription>청첩장 발행을 위해 결제를 진행해주세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">모바일 청첩장</span>
                <span className="font-medium">50,000원</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">총 결제금액</span>
                <span className="text-xl font-semibold">50,000원</span>
              </div>
            </div>
            <Button className="mt-4 w-full" size="lg" onClick={() => setIsPaymentOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              결제하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-800">
              <Check className="h-5 w-5" />
              발행 완료
            </CardTitle>
            <CardDescription className="text-green-700">
              청첩장이 성공적으로 발행되었습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-white p-4">
              <p className="mb-2 text-sm text-muted-foreground">청첩장 URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm">
                  {publishedUrl}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopyUrl}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" variant="outline">
                카카오톡 공유
              </Button>
              <Button className="flex-1" variant="outline">
                문자 공유
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          이전 단계
        </Button>
        {isPaid && (
          <Button onClick={() => router.push('/')}>
            홈으로 돌아가기
          </Button>
        )}
      </div>

      {/* Payment Modal */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>결제하기</DialogTitle>
            <DialogDescription>
              결제 수단을 선택해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <button
              className="flex w-full items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
              onClick={handlePayment}
              disabled={isProcessing}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium">신용/체크카드</p>
                <p className="text-sm text-muted-foreground">모든 카드 결제 가능</p>
              </div>
            </button>
            <button
              className="flex w-full items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
              onClick={handlePayment}
              disabled={isProcessing}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FEE500]">
                <span className="text-lg font-bold">K</span>
              </div>
              <div className="text-left">
                <p className="font-medium">카카오페이</p>
                <p className="text-sm text-muted-foreground">간편결제</p>
              </div>
            </button>
            <button
              className="flex w-full items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
              onClick={handlePayment}
              disabled={isProcessing}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#03C75A]">
                <span className="text-lg font-bold text-white">N</span>
              </div>
              <div className="text-left">
                <p className="font-medium">네이버페이</p>
                <p className="text-sm text-muted-foreground">간편결제</p>
              </div>
            </button>
          </div>
          {isProcessing && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              결제 처리 중...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        {isSuccessDialogOpen && <Confetti />}
        <DialogContent className="sm:max-w-md border border-green-200">
          <DialogHeader className="text-center flex flex-col items-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 animate-pulse">
              <Award className="h-8 w-8" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground text-center">
              청첩장 발행 완료! 🎉
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
              축하합니다! 소중한 첫걸음을 떼셨습니다.
              <br />
              발행 완료된 모바일 청첩장을 하객분들께 공유해 보세요.
            </DialogDescription>
          </DialogHeader>

          {/* Quick Actions Card */}
          <div className="mt-4 p-4 bg-muted/40 rounded-xl space-y-4 border">
            <div>
              <p className="text-xs text-muted-foreground mb-1">청첩장 발행 주소</p>
              <div className="flex items-center gap-2 bg-background border rounded-lg p-2">
                <span className="text-xs font-mono select-all flex-1 truncate pr-2">
                  {publishedUrl}
                </span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2 text-xs shrink-0" 
                  onClick={handleCopyUrl}
                >
                  {copied ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> 복사됨
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy className="h-3.5 w-3.5" /> 복사
                    </span>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button 
                variant="outline" 
                className="h-10 text-xs gap-1 border-slate-300"
                onClick={() => window.open(publishedUrl, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                직접 보기
              </Button>
              <Button 
                className="h-10 text-xs gap-1"
                onClick={() => router.push('/mypage')}
              >
                <Award className="h-3.5 w-3.5" />
                마이페이지 이동
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-4 sm:justify-center">
            <Button className="w-full sm:w-auto" variant="ghost" onClick={() => setIsSuccessDialogOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
