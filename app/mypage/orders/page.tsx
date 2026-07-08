'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { ArrowLeft, Loader2, Calendar, CreditCard, ExternalLink, Receipt } from 'lucide-react'
import { toast } from 'sonner'

export default function OrdersPage() {
  const router = useRouter()
  const { user } = useAppStore()
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('로그인이 필요한 페이지입니다.')
        router.push('/login')
        return
      }

      const userId = session.user.id
      try {
        const { data, error } = await supabase.from('orders').select('*')
        if (error) throw error

        if (data) {
          // Filter orders belonging to current user by checking ID prefix
          const userOrders = data.filter((order: any) => order.id.startsWith(`${userId}__`))
          // Sort by date descending
          userOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          setOrders(userOrders)
        }
      } catch (err) {
        console.error('Error fetching user orders:', err)
        toast.error('주문 내역을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [user, router])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'deployed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">발행 완료</Badge>
      case 'paid':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">결제 완료</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">결제 대기</Badge>
      case 'refunded':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">환불됨</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1 py-12">
        <div className="container max-w-4xl px-4 space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/mypage">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">뒤로가기</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">주문/결제 내역</h1>
              <p className="text-sm text-muted-foreground mt-1">
                회원님께서 결제 및 발행하신 모바일 청첩장의 전체 내역입니다.
              </p>
            </div>
          </div>

          {orders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Receipt className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">주문 내역이 없습니다</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center">
                  아직 결제하신 청첩장이 없습니다. 청첩장을 제작하고 발행해보세요.
                </p>
                <Button asChild>
                  <Link href="/mypage">내 청첩장 보러가기</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="overflow-hidden border border-border/80 shadow-sm">
                  <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6 flex flex-row flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">주문일자:</span> {order.createdAt}
                      </div>
                      <div className="hidden sm:block">
                        <span className="font-medium text-foreground">주문번호:</span> {order.id.split('__')[1] || order.id}
                      </div>
                    </div>
                    <div>
                      {getStatusBadge(order.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid gap-6 md:grid-cols-3 items-center">
                      <div className="md:col-span-2 space-y-1.5">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{order.theme} 테마</div>
                        <h3 className="text-lg font-bold text-foreground">
                          {order.groomName} ♥ {order.brideName} 결혼 청첩장
                        </h3>
                        {order.weddingDate && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            예식일: {order.weddingDate}
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 md:text-right border-t md:border-t-0 pt-4 md:pt-0 border-border/50">
                        <div className="text-sm text-muted-foreground">결제금액</div>
                        <div className="text-xl font-bold text-foreground">
                          {order.amount.toLocaleString()}원
                        </div>
                        {order.status === 'deployed' && (
                          <Button size="sm" variant="outline" className="w-full md:w-auto gap-1 text-xs" asChild>
                            <Link href={`/invitation/${order.invitationId}`} target="_blank">
                              <ExternalLink className="w-3 h-3" />
                              청첩장 보기
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
