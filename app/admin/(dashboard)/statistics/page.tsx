'use client'

import { useState, useEffect } from 'react'
import { supabase, logSupabaseError } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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



export default function StatisticsPage() {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  })

  const [invitations, setInvitations] = useState<any[]>([])
  const [orders, setOrdersData] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [visitLogs, setVisitLogs] = useState<any[]>([])
  const [themeNames, setThemeNames] = useState<Record<string, string>>({})
  const [bgmNames, setBgmNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true)
        const { data: invData, error: invError } = await supabase
          .from('invitations')
          .select(`
            *,
            customer:customer_id (
              id,
              groom_name,
              bride_name,
              wedding_date
            )
          `)
        logSupabaseError('statistics: invitations', invError)

        // 매출은 청첩장 건당 5만원 고정이 아니라 실제 orders.amount 합계를 쓴다(§1-B).
        // 주문 관리 화면은 없어졌지만(고객 관리로 통합) amount/notes 데이터는 orders
        // 테이블에 그대로 남아있으므로 매출 집계는 계속 여기서 읽는다.
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('amount, created_at')
        logSupabaseError('statistics: orders', ordersError)

        // 건수 지표(총 고객 수, 일별 신규 등록)는 orders 가 아니라 customers 기준으로 센다.
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('id, status, created_at')
          .is('deleted_at', null)
        logSupabaseError('statistics: customers', customersError)

        // 시간대별 트래픽은 visit_daily_stats(일 단위 집계)가 아니라 visit_logs 의
        // 실제 방문 시각(visited_at)에서 직접 시간대를 뽑아야 정확하다.
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const { data: logsData, error: logsError } = await supabase
          .from('visit_logs')
          .select('visited_at')
          .gte('visited_at', sevenDaysAgo.toISOString())
        logSupabaseError('statistics: visit_logs', logsError)

        if (invData) setInvitations(invData)
        if (ordersData) setOrdersData(ordersData)
        if (customersData) setCustomers(customersData)
        if (logsData) setVisitLogs(logsData)

        // 테마 이름 해석: theme_version_id → theme_versions.theme_id → themes.name
        const versionIds = Array.from(new Set((invData || []).map((i: any) => i.theme_version_id).filter(Boolean)))
        if (versionIds.length > 0) {
          const { data: versions, error: vErr } = await supabase
            .from('theme_versions')
            .select('id, theme_id')
            .in('id', versionIds)
          logSupabaseError('statistics: theme_versions', vErr)
          const themeIds = Array.from(new Set((versions || []).map((v: any) => v.theme_id).filter(Boolean)))
          const versionToTheme: Record<string, string> = {}
          ;(versions || []).forEach((v: any) => { versionToTheme[v.id] = v.theme_id })

          let themeIdToName: Record<string, string> = {}
          if (themeIds.length > 0) {
            const { data: themesData, error: tErr } = await supabase
              .from('themes')
              .select('id, name')
              .in('id', themeIds)
            logSupabaseError('statistics: themes', tErr)
            ;(themesData || []).forEach((t: any) => { themeIdToName[t.id] = t.name })
          }
          const versionToName: Record<string, string> = {}
          versionIds.forEach((vid: any) => {
            const themeId = versionToTheme[vid]
            versionToName[vid] = (themeId && themeIdToName[themeId]) || '알 수 없는 테마'
          })
          setThemeNames(versionToName)
        }

        // BGM 이름 해석: 레거시 content_data.bgmId 는 실제로는 bgms.id(uuid) 참조가
        // 아니라 파일명 형태의 문자열이 그대로 들어있다("Paper Swan.mp3" 등) —
        // bgms 테이블 uuid 조인을 시도하면 타입 에러가 난다. bgms.id 로 매칭되는
        // 경우만 이름으로 치환하고, 아니면 원본 문자열을 그대로 이름으로 쓴다.
        const bgmIds = Array.from(new Set((invData || []).map((i: any) => i.content_data?.bgmId).filter(Boolean)))
        const uuidLike = bgmIds.filter((id: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        if (uuidLike.length > 0) {
          const { data: bgmsData, error: bErr } = await supabase
            .from('bgms')
            .select('id, name')
            .in('id', uuidLike)
          logSupabaseError('statistics: bgms', bErr)
          const map: Record<string, string> = {}
          ;(bgmsData || []).forEach((b: any) => { map[b.id] = b.name })
          setBgmNames(map)
        }
      } catch (err) {
        console.error('Error fetching statistics:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  // 1. 일별 매출/신규 고객 — 매출은 orders.amount 실합계(§1-B: 5만원 고정 아님)를 쓰고,
  // 건수는 orders 가 아니라 customers 신규 등록 건수로 센다(§ 주문 관리 → 고객 관리 통합).
  const revenueMap: Record<string, { date: string; revenue: number; newCustomers: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = subDays(new Date(), i)
    const dateStr = format(d, 'MM/dd')
    revenueMap[dateStr] = { date: dateStr, revenue: 0, newCustomers: 0 }
  }

  orders.forEach((o) => {
    if (!o.created_at) return
    const dateStr = format(new Date(o.created_at), 'MM/dd')
    if (revenueMap[dateStr]) {
      revenueMap[dateStr].revenue += o.amount || 0
    }
  })
  customers.forEach((c) => {
    if (!c.created_at) return
    const dateStr = format(new Date(c.created_at), 'MM/dd')
    if (revenueMap[dateStr]) {
      revenueMap[dateStr].newCustomers += 1
    }
  })
  const revenueData = Object.values(revenueMap)

  // 2. 테마 사용 현황 — theme_version_id(uuid)를 문자열 매칭으로 추측하지 않고
  // themeNames(theme_versions → themes.name 조인 결과)로 실제 이름을 쓴다.
  const themeColorPalette = ['#B08D57', '#1A1A1A', '#9CAF88', '#FFB6C1', '#7C9CBF', '#C97C5D']
  const themeCounts: Record<string, number> = {}
  invitations.forEach((inv) => {
    const themeName = (inv.theme_version_id && themeNames[inv.theme_version_id]) || '테마 미지정'
    themeCounts[themeName] = (themeCounts[themeName] || 0) + 1
  })
  const totalInvCount = invitations.length || 1
  const themeUsageData = Object.entries(themeCounts).map(([name, val], idx) => ({
    name,
    value: Math.round((val / totalInvCount) * 100),
    color: themeColorPalette[idx % themeColorPalette.length],
  }))

  // 3. BGM 사용 현황 — bgmNames(bgms.name 조인 결과)로 실제 이름을 쓴다.
  // 템플릿 엔진 청첩장은 bgmId 대신 raw bgm_url 을 쓰므로 이 집계엔 포함되지 않는다.
  const bgmCounts: Record<string, number> = {}
  invitations.forEach((inv) => {
    const bgmId = inv.content_data?.bgmId
    if (!bgmId) return
    const bgmName = bgmNames[bgmId] || bgmId
    bgmCounts[bgmName] = (bgmCounts[bgmName] || 0) + 1
  })
  const bgmUsageData = Object.entries(bgmCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // 4. 시간대별 트래픽 — visit_logs.visited_at 실제 방문 시각을 3시간 단위로 집계.
  // 기저값을 깔지 않으므로 방문이 없으면 그래프도 0으로 정직하게 표시된다.
  const trafficBuckets = ['00', '04', '08', '12', '16', '20']
  const trafficMap: Record<string, number> = Object.fromEntries(trafficBuckets.map(h => [h, 0]))
  visitLogs.forEach((log) => {
    if (!log.visited_at) return
    const hour = new Date(log.visited_at).getHours()
    const bucket = trafficBuckets[Math.floor(hour / 4)] ?? '00'
    trafficMap[bucket] += 1
  })
  const trafficData = trafficBuckets.map((hour) => ({ hour, visits: trafficMap[hour] }))

  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
  const totalCustomers = customers.length

  // Calculate RSVP Activation rate
  const rsvpActiveCount = invitations.filter(inv => inv.content_data?.rsvpEnabled !== false).length
  const rsvpActivationRate = invitations.length > 0 ? Math.round((rsvpActiveCount / invitations.length) * 100) : 100

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-60" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-56 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

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
              총 고객 수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCustomers}명</div>
            <p className="mt-1 text-xs text-muted-foreground">
              전체 누적 등록 고객 수
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
              전체 누적 매출 (orders.amount 합계)
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
          <CardDescription>최근 7일 일별 매출액 및 신규 고객 등록 건수</CardDescription>
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
                    name === 'revenue' ? `${value.toLocaleString()}원` : `${value}명`,
                    name === 'revenue' ? '매출' : '신규 고객'
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
                  dataKey="newCustomers"
                  name="신규 고객"
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
              {themeUsageData.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  아직 등록된 청첩장이 없습니다.
                </div>
              )}
              {themeUsageData.length > 0 && (
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* BGM Usage */}
        <Card>
          <CardHeader>
            <CardTitle>BGM 사용 순위</CardTitle>
            <CardDescription>가장 많이 선택된 배경음악 (레거시 테마 한정)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {bgmUsageData.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  집계할 BGM 선택 데이터가 없습니다.
                </div>
              )}
              {bgmUsageData.length > 0 && (
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
              )}
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
