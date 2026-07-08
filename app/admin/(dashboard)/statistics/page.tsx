'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts'

const revenueData = [
  { date: '01/01', revenue: 250000, count: 5 },
  { date: '01/02', revenue: 300000, count: 6 },
  { date: '01/03', revenue: 150000, count: 3 },
  { date: '01/04', revenue: 400000, count: 8 },
  { date: '01/05', revenue: 350000, count: 7 },
  { date: '01/06', revenue: 500000, count: 10 },
  { date: '01/07', revenue: 200000, count: 4 },
]

const themeUsageData = [
  { name: 'Classic White', value: 35, color: '#F5F5F0' },
  { name: 'Romantic Rose', value: 25, color: '#FFB6C1' },
  { name: 'Modern Minimal', value: 20, color: '#1A1A1A' },
  { name: 'Garden Greenery', value: 12, color: '#9CAF88' },
  { name: 'Others', value: 8, color: '#D1D5DB' },
]

const bgmUsageData = [
  { name: 'Canon in D', count: 45 },
  { name: 'A Thousand Years', count: 32 },
  { name: 'Perfect', count: 28 },
  { name: 'River Flows in You', count: 18 },
  { name: 'Wedding March', count: 12 },
]

const trafficData = [
  { hour: '00', visits: 120 },
  { hour: '04', visits: 45 },
  { hour: '08', visits: 280 },
  { hour: '12', visits: 520 },
  { hour: '16', visits: 380 },
  { hour: '20', visits: 450 },
]

export default function StatisticsPage() {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  })

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0)
  const totalOrders = revenueData.reduce((sum, d) => sum + d.count, 0)
  const rsvpActivationRate = 78

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">통계</h1>
          <p className="text-muted-foreground">서비스 이용 현황을 분석합니다.</p>
        </div>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn(
              'min-w-[240px] justify-start text-left font-normal',
            )}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'yyyy.MM.dd', { locale: ko })} -{' '}
                    {format(dateRange.to, 'yyyy.MM.dd', { locale: ko })}
                  </>
                ) : (
                  format(dateRange.from, 'PPP', { locale: ko })
                )
              ) : (
                '기간 선택'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={dateRange as any}
              onSelect={(range: any) => setDateRange(range || {})}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 결제 건수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalOrders}건</div>
            <p className="mt-1 text-xs text-muted-foreground">
              선택 기간 내 결제 건수
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 매출액
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalRevenue.toLocaleString()}원</div>
            <p className="mt-1 text-xs text-muted-foreground">
              선택 기간 내 총 매출
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              RSVP 활성화율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rsvpActivationRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              RSVP 기능 사용 비율
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>매출 추이</CardTitle>
          <CardDescription>일별 결제 건수 및 매출액</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis 
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'revenue' ? `${value.toLocaleString()}원` : `${value}건`,
                    name === 'revenue' ? '매출' : '건수'
                  ]}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="revenue" 
                  name="매출"
                  stroke="hsl(var(--foreground))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--foreground))' }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="count" 
                  name="건수"
                  stroke="hsl(var(--muted-foreground))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: 'hsl(var(--muted-foreground))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Theme Usage */}
        <Card>
          <CardHeader>
            <CardTitle>테마 사용 현황</CardTitle>
            <CardDescription>인기 있는 청첩장 테마</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={themeUsageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {themeUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(var(--border))" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any) => [`${value}%`, '사용률']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* BGM Usage */}
        <Card>
          <CardHeader>
            <CardTitle>BGM 사용 순위</CardTitle>
            <CardDescription>가장 많이 선택된 배경음악</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bgmUsageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={11}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any) => [`${value}회`, '선택 횟수']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Chart */}
      <Card>
        <CardHeader>
          <CardTitle>트래픽 추이</CardTitle>
          <CardDescription>시간대별 방문자 수</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: any) => [`${value}명`, '방문자']}
                  labelFormatter={(label) => `${label}:00`}
                />
                <Bar dataKey="visits" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
