'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CustomerStatusBadge } from '@/components/customer-status-badge'
import { useAppStore } from '@/lib/store'
import { useCustomersQuery } from '@/hooks/queries/useCustomers'
import {
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  Users,
  Palette,
  BarChart3,
  ArrowUpRight
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토']

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function AdminDashboard() {
  const { orders } = useAppStore()
  const { data: recentCustomersData } = useCustomersQuery({}, 1, 5)
  const recentCustomers = recentCustomersData?.data || []

  // 실제 결제는 네이버 스마트스토어에서 앱 밖에서 이뤄지므로, 여기서는
  // "오늘 등록된 주문"을 집계한다(§1-B orders 재정의 참고).
  const todayStr = new Date().toISOString().split('T')[0]
  const todaysOrders = orders.filter(o => o.createdAt === todayStr)
  const todayPayments = todaysOrders.length
  const todayRevenue = todaysOrders.reduce((sum, o) => sum + (o.amount || 0), 0)
  const thisWeekWeddings = orders.filter(o => {
    const weddingDate = new Date(o.weddingDate)
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return weddingDate >= now && weddingDate <= weekLater
  }).length

  // 일별(최근 7일) — orders.createdAt 기준으로 등록 건수·금액 집계
  const dailyData = useMemo(() => {
    const today = new Date()
    const days: { name: string; count: number; amount: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = toDateStr(d)
      const dayOrders = orders.filter(o => o.createdAt === dateStr)
      days.push({
        name: WEEKDAY_LABEL[d.getDay()],
        count: dayOrders.length,
        amount: dayOrders.reduce((sum, o) => sum + (o.amount || 0), 0),
      })
    }
    return days
  }, [orders])

  // 주별(최근 8주) — 7일 단위로 묶어 이번 주부터 7주 전까지
  const weeklyData = useMemo(() => {
    const today = new Date()
    const weeks: { name: string; count: number; amount: number }[] = []
    for (let w = 7; w >= 0; w--) {
      const end = new Date(today)
      end.setDate(end.getDate() - w * 7)
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      const startStr = toDateStr(start)
      const endStr = toDateStr(end)
      const weekOrders = orders.filter(o => o.createdAt >= startStr && o.createdAt <= endStr)
      weeks.push({
        name: `${start.getMonth() + 1}/${start.getDate()}`,
        count: weekOrders.length,
        amount: weekOrders.reduce((sum, o) => sum + (o.amount || 0), 0),
      })
    }
    return weeks
  }, [orders])

  const dailyTotalCount = dailyData.reduce((sum, d) => sum + d.count, 0)
  const dailyTotalAmount = dailyData.reduce((sum, d) => sum + d.amount, 0)
  const weeklyTotalCount = weeklyData.reduce((sum, d) => sum + d.count, 0)
  const weeklyTotalAmount = weeklyData.reduce((sum, d) => sum + d.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">VOW SEOUL 서비스 현황을 확인하세요.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              금일 등록 건수
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayPayments}건</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+12%</span> 전일 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              금일 매출
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayRevenue.toLocaleString()}원</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+8%</span> 전일 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              이번 주 예식
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisWeekWeddings}건</div>
            <p className="text-xs text-muted-foreground">
              예정된 예식 건수
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              시스템 상태
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">정상</div>
            <p className="text-xs text-muted-foreground">
              모든 서비스 운영 중
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Payment Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>주간 결제 현황</CardTitle>
            <CardDescription>등록된 주문(제작 의뢰) 건수·금액 추이 — 실제 결제는 앱 밖(네이버 스마트스토어)에서 이뤄집니다</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="daily">
              <TabsList>
                <TabsTrigger value="daily">주간 (일별)</TabsTrigger>
                <TabsTrigger value="weekly">월간 (주별)</TabsTrigger>
              </TabsList>

              <TabsContent value="daily" className="space-y-2">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`${value}건`, '등록']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--foreground))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground">
                  최근 7일 총 {dailyTotalCount}건 · {dailyTotalAmount.toLocaleString()}원
                </p>
              </TabsContent>

              <TabsContent value="weekly" className="space-y-2">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`${value}건`, '등록']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--foreground))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground">
                  최근 8주 총 {weeklyTotalCount}건 · {weeklyTotalAmount.toLocaleString()}원
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>빠른 이동</CardTitle>
            <CardDescription>자주 사용하는 메뉴</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link href="/admin/customers">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  고객 관리
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link href="/admin/assets">
                <span className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  에셋 관리
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link href="/admin/statistics">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  통계
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Customers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>최근 등록 고객</CardTitle>
            <CardDescription>최근 등록된 고객과 진행 상태</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/customers">전체 보기</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {/* 모바일 카드 리스트 — sm 미만에서는 5열 테이블 대신 카드로 보여준다 */}
          <div className="sm:hidden divide-y divide-border">
            {recentCustomers.map((customer) => (
              <div key={customer.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{customer.groom_name} & {customer.bride_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(customer.created_at).toLocaleDateString('ko-KR')} 등록 · {customer.wedding_date || '예식일 미정'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{customer.venue_name || '식장 미정'}</p>
                </div>
                <CustomerStatusBadge status={customer.status} />
              </div>
            ))}
            {recentCustomers.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">등록된 고객이 없습니다.</p>
            )}
          </div>

          {/* 데스크톱/태블릿 테이블 — sm 이상에서만 보인다 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted-foreground">
                  <th className="pb-3 pr-4">등록일</th>
                  <th className="pb-3 pr-4">신랑신부</th>
                  <th className="pb-3 pr-4">예식일</th>
                  <th className="pb-3 pr-4">예식장</th>
                  <th className="pb-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {recentCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-sm">{new Date(customer.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="py-3 pr-4 text-sm font-medium">
                      {customer.groom_name} & {customer.bride_name}
                    </td>
                    <td className="py-3 pr-4 text-sm">{customer.wedding_date || '-'}</td>
                    <td className="py-3 pr-4 text-sm">{customer.venue_name || '-'}</td>
                    <td className="py-3">
                      <CustomerStatusBadge status={customer.status} />
                    </td>
                  </tr>
                ))}
                {recentCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      등록된 고객이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
