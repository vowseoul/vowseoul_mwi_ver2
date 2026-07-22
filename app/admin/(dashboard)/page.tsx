'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { useEffect } from 'react'
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  AlertCircle,
  ShoppingCart,
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

const weeklyData = [
  { name: '월', value: 3 },
  { name: '화', value: 5 },
  { name: '수', value: 2 },
  { name: '목', value: 8 },
  { name: '금', value: 4 },
  { name: '토', value: 6 },
  { name: '일', value: 3 },
]

export default function AdminDashboard() {
  const { orders } = useAppStore()

  const todayPayments = orders.filter(o => o.status === 'paid' || o.status === 'deployed').length
  const todayRevenue = todayPayments * 50000
  const thisWeekWeddings = orders.filter(o => {
    const weddingDate = new Date(o.weddingDate)
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return weddingDate >= now && weddingDate <= weekLater
  }).length

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
              금일 결제 건수
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
        {/* Traffic Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>주간 결제 현황</CardTitle>
            <CardDescription>최근 7일간 결제 건수 추이</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--foreground))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--foreground))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
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
              <Link href="/admin/orders">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  주문 관리
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

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>최근 주문</CardTitle>
            <CardDescription>최근 접수된 주문 내역</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">전체 보기</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted-foreground">
                  <th className="pb-3 pr-4">주문일시</th>
                  <th className="pb-3 pr-4">신랑신부</th>
                  <th className="pb-3 pr-4">예식일</th>
                  <th className="pb-3 pr-4">테마</th>
                  <th className="pb-3 pr-4">금액</th>
                  <th className="pb-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-sm">{order.createdAt}</td>
                    <td className="py-3 pr-4 text-sm font-medium">
                      {order.groomName} & {order.brideName}
                    </td>
                    <td className="py-3 pr-4 text-sm">{order.weddingDate}</td>
                    <td className="py-3 pr-4 text-sm">{order.theme}</td>
                    <td className="py-3 pr-4 text-sm">{order.amount.toLocaleString()}원</td>
                    <td className="py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        order.status === 'deployed' ? 'bg-green-100 text-green-700' :
                        order.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'expired' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {order.status === 'deployed' ? '배포중' :
                         order.status === 'paid' ? '결제완료' :
                         order.status === 'expired' ? '만료됨' : '환불'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
