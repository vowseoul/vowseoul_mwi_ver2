'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Logo } from '@/components/logo'
import {
  Users,
  MessageSquare,
  Download,
  Trash2,
  ArrowLeft,
  ShieldAlert,
  CalendarDays,
  Utensils,
  Bus,
  Pencil
} from 'lucide-react'
import { toast } from 'sonner'

export interface RSVP {
  id: string
  name: string
  phone?: string
  attendance: string
  side?: string // 'groom' | 'bride'
  guestCount: number
  mealType?: string
  shuttleUsed?: boolean
  mealInfo?: Record<string, number>
  message?: string
  createdAt: string
}

export interface GuestbookMessage {
  id: string
  name: string
  message: string
  is_visible: boolean
  createdAt: string
}

/** 서버가 visit_daily_stats(+오늘 하루치 실시간 카운트)로 미리 집계해 넘겨주는 일별 방문수 */
export interface DailyVisitStat {
  date: string
  count: number
}

/** 서버 컴포넌트가 미리 해석해 넘겨주는 표시용 정보 */
export interface DashboardHeaderInfo {
  groomName: string
  brideName: string
  venueName: string
  weddingDate: string
  weddingTime: string
  publicSlug: string
}

/** 하객 데이터 변경은 전부 서명 쿠키를 검증하는 서버 라우트를 거친다 */
async function postDashboardAction(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/dashboard-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return true
    const result = await res.json().catch(() => ({}))
    toast.error(result?.error || '요청을 처리하지 못했습니다.')
    return false
  } catch (err) {
    console.error('dashboard action failed:', err)
    toast.error('요청을 처리하지 못했습니다.')
    return false
  }
}

/**
 * 신랑신부 대시보드 본문.
 *
 * 인증(서명 쿠키 검증), 만료·파기 정책 판정, 하객 데이터 조회까지 전부 부모
 * Server Component 가 끝낸 뒤에만 이 컴포넌트가 렌더된다 — 하객 개인정보는
 * anon 키로 읽히면 안 되므로 브라우저에서 직접 조회하지 않는다.
 */
export default function CustomerDashboardClient({
  invitationId,
  header,
  initialRsvps,
  initialGuestbook,
  totalVisits,
  dailyVisitStats,
  selfEditEnabled,
}: {
  invitationId: string
  header: DashboardHeaderInfo
  initialRsvps: RSVP[]
  initialGuestbook: GuestbookMessage[]
  totalVisits: number
  dailyVisitStats: DailyVisitStat[]
  selfEditEnabled: boolean
}) {
  const [rsvps, setRsvps] = useState<RSVP[]>(initialRsvps)
  const [guestbook, setGuestbook] = useState<GuestbookMessage[]>(initialGuestbook)

  // 방명록이 수백 건 쌓이면 표 전체를 한 번에 렌더링하는 게 무거워져 5개씩 페이지네이션한다
  const GUESTBOOK_PAGE_SIZE = 5
  const [guestbookPage, setGuestbookPage] = useState(1)
  const [selectedGuestbookIds, setSelectedGuestbookIds] = useState<Set<string>>(new Set())
  const guestbookTotalPages = Math.max(1, Math.ceil(guestbook.length / GUESTBOOK_PAGE_SIZE))
  const safeGuestbookPage = Math.min(guestbookPage, guestbookTotalPages)
  const pagedGuestbook = guestbook.slice(
    (safeGuestbookPage - 1) * GUESTBOOK_PAGE_SIZE,
    safeGuestbookPage * GUESTBOOK_PAGE_SIZE
  )
  const allPagedSelected = pagedGuestbook.length > 0 && pagedGuestbook.every(m => selectedGuestbookIds.has(m.id))
  const toggleSelectAllOnPage = () => {
    setSelectedGuestbookIds(prev => {
      const next = new Set(prev)
      if (allPagedSelected) pagedGuestbook.forEach(m => next.delete(m.id))
      else pagedGuestbook.forEach(m => next.add(m.id))
      return next
    })
  }

  // 방명록 노출 여부 전환
  const handleToggleVisibility = async (id: string, currentVal: boolean) => {
    const updatedVal = !currentVal
    const ok = await postDashboardAction({
      action: 'toggleGuestbook', invitationId, id, isVisible: updatedVal,
    })
    if (!ok) return

    setGuestbook(prev => prev.map(msg => msg.id === id ? { ...msg, is_visible: updatedVal } : msg))
    toast.success(updatedVal ? '해당 방명록이 청첩장 링크에 다시 공개됩니다.' : '해당 방명록이 청첩장 링크에서 숨김 처리되었습니다.')
  }

  // 하객 RSVP / 방명록 단일 삭제
  const handleDeleteItem = async (id: string, type: 'rsvp' | 'guestbook') => {
    const ok = await postDashboardAction({ action: 'delete', invitationId, id, target: type })
    if (!ok) return

    if (type === 'rsvp') {
      setRsvps(prev => prev.filter(r => r.id !== id))
      toast.success('참석 정보가 영구 삭제되었습니다.')
    } else {
      setGuestbook(prev => prev.filter(g => g.id !== id))
      toast.success('방명록 축하 한마디가 삭제되었습니다.')
    }
  }

  // 방명록 일괄 숨김/삭제 — 방명록이 많이 쌓이면 하나씩 숨기는 게 번거로워 여러 건을 한 번에 처리한다.
  // 별도 서버 라우트를 새로 만들지 않고 기존 단일 액션(/api/dashboard-data)을 선택 건수만큼 병렬 호출한다.
  const toggleGuestbookSelection = (id: string) => {
    setSelectedGuestbookIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkHide = async () => {
    const ids = Array.from(selectedGuestbookIds)
    const results = await Promise.all(
      ids.map(id => postDashboardAction({ action: 'toggleGuestbook', invitationId, id, isVisible: false }))
    )
    const succeeded = new Set(ids.filter((_, i) => results[i]))
    if (succeeded.size > 0) {
      setGuestbook(prev => prev.map(m => succeeded.has(m.id) ? { ...m, is_visible: false } : m))
      toast.success(`${succeeded.size}건 숨김 처리했습니다.`)
    }
    setSelectedGuestbookIds(new Set())
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedGuestbookIds)
    if (!confirm(`선택한 방명록 ${ids.length}건을 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return
    const results = await Promise.all(
      ids.map(id => postDashboardAction({ action: 'delete', invitationId, id, target: 'guestbook' }))
    )
    const succeeded = new Set(ids.filter((_, i) => results[i]))
    if (succeeded.size > 0) {
      setGuestbook(prev => prev.filter(m => !succeeded.has(m.id)))
      toast.success(`${succeeded.size}건 삭제했습니다.`)
    }
    setSelectedGuestbookIds(new Set())
  }

  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = "﻿" + [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadRsvpsCsv = () => {
    if (rsvps.length === 0) {
      toast.error('다운로드할 RSVP 응답 데이터가 없습니다.')
      return
    }
    downloadCsv(
      `VOW_SEOUL_RSVP_${header.groomName}_${header.brideName}.csv`,
      ['응답일자', '구분(신랑/신부측)', '작성자', '연락처', '참석여부', '동행인 수', '식사여부', '셔틀 이용여부', '메시지'],
      rsvps.map(r => [
        r.createdAt ? new Date(r.createdAt).toLocaleDateString('ko-KR') : '-',
        r.side === 'groom' ? '신랑측' : r.side === 'bride' ? '신부측' : '-',
        r.name,
        r.phone || '-',
        r.attendance === 'yes' ? '참석' : '불참',
        r.attendance === 'yes' ? `${r.guestCount}명` : '0명',
        r.attendance === 'yes' ? (r.mealInfo && Object.keys(r.mealInfo).length > 0
          ? Object.entries(r.mealInfo).map(([k, v]) => `${k}:${v}개`).join(', ')
          : (r.mealType === 'korean' ? '한식' : r.mealType === 'western' ? '양식' : (r.mealType || '안함'))) : '-',
        r.attendance === 'yes' ? (r.shuttleUsed ? '이용함' : '이용안함') : '-',
        r.message || '',
      ]),
    )
  }

  const downloadGuestbookCsv = () => {
    if (guestbook.length === 0) {
      toast.error('다운로드할 방명록 데이터가 없습니다.')
      return
    }
    downloadCsv(
      `VOW_SEOUL_방명록_${header.groomName}_${header.brideName}.csv`,
      ['응답일자', '이름', '축하메세지'],
      guestbook.map(g => [
        g.createdAt ? new Date(g.createdAt).toLocaleDateString('ko-KR') : '-',
        g.name,
        g.message,
      ]),
    )
  }

  // 최근 7일 방문자 추이 — 서버가 visit_daily_stats로 미리 집계해 넘겨준 값을 그대로 쓴다
  const chartData = dailyVisitStats.map(({ date, count }) => {
    const parts = date.split('-')
    return { label: `${parts[1]}/${parts[2]}`, count }
  })
  const maxCount = Math.max(...chartData.map(d => d.count), 1)

  const totalAttendingRsvps = rsvps.filter(r => r.attendance === 'yes')
  const groomSideGuests = totalAttendingRsvps.filter(r => r.side === 'groom').reduce((a, b) => a + (b.guestCount || 1), 0)
  const brideSideGuests = totalAttendingRsvps.filter(r => r.side === 'bride').reduce((a, b) => a + (b.guestCount || 1), 0)
  const totalAttendingGuests = totalAttendingRsvps.reduce((a, b) => a + (b.guestCount || 1), 0)
  const shuttleCount = totalAttendingRsvps.filter(r => r.shuttleUsed).reduce((a, b) => a + (b.guestCount || 1), 0)

  const mealSummary: Record<string, number> = {}
  totalAttendingRsvps.forEach(r => {
    if (r.mealInfo) {
      Object.entries(r.mealInfo).forEach(([k, v]) => {
        mealSummary[k] = (mealSummary[k] || 0) + (v || 0)
      })
    } else if (r.mealType && r.mealType !== 'none') {
      const legacyKey = r.mealType === 'korean' ? '한식' : r.mealType === 'western' ? '양식' : r.mealType
      mealSummary[legacyKey] = (mealSummary[legacyKey] || 0) + (r.guestCount || 1)
    }
  })

  return (
    <div className="min-h-screen bg-muted/30 pb-16 font-sans text-foreground">
      {/* Header */}
      <header className="bg-background border-b border-border/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-5 w-auto text-foreground" />
            <span className="text-[10px] bg-secondary text-secondary-foreground font-semibold px-2 py-0.5 rounded-full">
              모바일 청첩장 대시보드
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {selfEditEnabled && (
              <Link href={`/invitation/${invitationId}/edit`}>
                <Button variant="ghost" size="sm" className="text-xs gap-1.5 hover:bg-muted">
                  <Pencil className="w-3.5 h-3.5" /> 정보 수정
                </Button>
              </Link>
            )}
            <Link href={header.publicSlug ? `/w/${header.publicSlug}` : "#"}>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 hover:bg-muted">
                <ArrowLeft className="w-3.5 h-3.5" /> 청첩장 확인
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {header.groomName} ♡ {header.brideName} 예식 관리
            </h1>
            <p className="text-xs text-muted-foreground font-light mt-1">
              {[header.venueName, [header.weddingDate, header.weddingTime].filter(Boolean).join(' ')]
                .filter(Boolean)
                .join(' | ') || '예식 정보가 아직 입력되지 않았습니다.'}
            </p>
          </div>
        </div>

        {/* Dashboard Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border/70 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">총 누적 방문수</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalVisits}회</div>
            </CardContent>
          </Card>
          <Card className="border border-border/70 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">RSVP 하객 응답</CardTitle>
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rsvps.length}건</div>
            </CardContent>
          </Card>
          <Card className="border border-border/70 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">방명록 글 개수</CardTitle>
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{guestbook.length}개</div>
            </CardContent>
          </Card>
        </div>

        {/* Visitor graph */}
        <Card className="border border-border/70 shadow-sm bg-background">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">최근 7일 방문자 추이</CardTitle>
            <CardDescription className="text-xs">일자별 접속 횟수 추이</CardDescription>
          </CardHeader>
          <CardContent className="h-56 flex items-end justify-between gap-2 pt-4 px-6 md:px-12 border-t border-border/30">
            {chartData.map((d) => {
              const heightPct = (d.count / maxCount) * 80 // Max height 80%
              return (
                <div key={d.label} className="flex flex-col items-center flex-1 group">
                  <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors mb-1 font-bold">
                    {d.count}
                  </span>
                  <div className="w-full bg-secondary group-hover:bg-[#9E8B7E] transition-colors rounded-t-sm" style={{ height: `${heightPct}%`, minHeight: '4px' }} />
                  <span className="text-[9px] text-muted-foreground mt-2 font-medium tracking-tight">
                    {d.label}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Tab section */}
        <Tabs defaultValue="rsvp" className="space-y-4">
          <TabsList className="bg-muted p-1 border border-border/40">
            <TabsTrigger value="rsvp" className="text-xs px-4">RSVP 하객 명단</TabsTrigger>
            <TabsTrigger value="guestbook" className="text-xs px-4">축하 방명록</TabsTrigger>
          </TabsList>

          {/* RSVP Tab Content */}
          <TabsContent value="rsvp" className="space-y-4">
            {/* Statistics Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border border-border/60 bg-background/50 shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-[11px] font-semibold text-muted-foreground">구분별 참석 하객</CardTitle>
                </CardHeader>
                <CardContent className="text-sm font-medium space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs font-light text-muted-foreground">총 참석 인원:</span>
                    <span>{totalAttendingGuests}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light text-muted-foreground">신랑측:</span>
                    <span>{groomSideGuests}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light text-muted-foreground">신부측:</span>
                    <span>{brideSideGuests}명</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/60 bg-background/50 shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Utensils className="w-3.5 h-3.5" /> 식사 희망 수량
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm font-medium space-y-1">
                  {Object.keys(mealSummary).length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-2">수집 정보 없음</div>
                  ) : (
                    Object.entries(mealSummary).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-xs font-light text-muted-foreground">{key}:</span>
                        <span>{val}개</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/60 bg-background/50 shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Bus className="w-3.5 h-3.5" /> 셔틀버스 이용
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm font-medium space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs font-light text-muted-foreground">셔틀 버스 승차 인원:</span>
                    <span>{shuttleCount}명</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border/70 shadow-sm bg-background">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">참석 응답 내역</CardTitle>
                  <CardDescription className="text-xs">하객들이 응답한 최종 상세 명단입니다.</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={downloadRsvpsCsv}>
                  <Download className="w-3.5 h-3.5" /> 엑셀 다운로드
                </Button>
              </CardHeader>
              <CardContent className="p-0 border-t border-border/30">
                {rsvps.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground opacity-60">
                    접수된 RSVP 응답이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-center w-24">응답일자</TableHead>
                          <TableHead className="text-center w-20">구분</TableHead>
                          <TableHead className="text-center w-20">작성자</TableHead>
                          <TableHead className="text-center w-28">연락처</TableHead>
                          <TableHead className="text-center w-20">참석여부</TableHead>
                          <TableHead className="text-center w-20">인원수</TableHead>
                          <TableHead className="text-center w-36">식사선택</TableHead>
                          <TableHead className="text-center w-20">셔틀탑승</TableHead>
                          <TableHead className="text-left max-w-xs">코멘트</TableHead>
                          <TableHead className="text-center w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rsvps.map((rsvp) => (
                          <TableRow key={rsvp.id} className="hover:bg-muted/10 text-xs">
                            <TableCell className="text-center text-muted-foreground font-light">
                              {rsvp.createdAt ? new Date(rsvp.createdAt).toLocaleDateString('ko-KR') : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {rsvp.side === 'groom' && <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px]">신랑측</Badge>}
                              {rsvp.side === 'bride' && <Badge variant="secondary" className="bg-pink-50 text-pink-700 hover:bg-pink-100 text-[10px]">신부측</Badge>}
                              {!rsvp.side && '-'}
                            </TableCell>
                            <TableCell className="text-center font-medium">{rsvp.name}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{rsvp.phone || '-'}</TableCell>
                            <TableCell className="text-center">
                              {rsvp.attendance === 'yes' ? (
                                <span className="text-emerald-600 font-medium">참석</span>
                              ) : (
                                <span className="text-muted-foreground">불참</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {rsvp.attendance === 'yes' ? `${rsvp.guestCount}명` : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {rsvp.attendance === 'yes' ? (rsvp.mealInfo && Object.keys(rsvp.mealInfo).length > 0 ? (
                                <span className="text-muted-foreground leading-tight text-[11px]">
                                  {Object.entries(rsvp.mealInfo).map(([k, v]) => `${k}:${v}개`).join(', ')}
                                </span>
                              ) : (
                                rsvp.mealType === 'korean' ? '한식' : rsvp.mealType === 'western' ? '양식' : (rsvp.mealType || '안함')
                              )) : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {rsvp.attendance === 'yes' ? (rsvp.shuttleUsed ? '이용' : '안함') : '-'}
                            </TableCell>
                            <TableCell className="text-left font-light truncate max-w-xs" title={rsvp.message}>
                              {rsvp.message || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (confirm('해당 하객 참석 정보를 삭제하시겠습니까?')) {
                                    handleDeleteItem(rsvp.id, 'rsvp')
                                  }
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guestbook Tab Content */}
          <TabsContent value="guestbook" className="space-y-4">
            <Card className="border border-border/70 shadow-sm bg-background">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">방명록 축하 메시지 목록</CardTitle>
                  <CardDescription className="text-xs">
                    청첩장 하단에 노출 중인 하객 방명록 리스트입니다. (숨김 및 삭제가 가능합니다.)
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={downloadGuestbookCsv}>
                  <Download className="w-3.5 h-3.5" /> 엑셀 다운로드
                </Button>
              </CardHeader>
              <CardContent className="p-0 border-t border-border/30">
                {guestbook.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground opacity-60">
                    작성된 방명록이 없습니다.
                  </div>
                ) : (
                  <>
                    {selectedGuestbookIds.size > 0 && (
                      <div className="flex items-center justify-between gap-2 border-b border-border/30 bg-muted/20 px-4 py-2">
                        <span className="text-xs text-muted-foreground">{selectedGuestbookIds.size}개 선택됨</span>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkHide}>
                            선택 항목 숨기기
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={handleBulkDelete}>
                            선택 항목 삭제
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox checked={allPagedSelected} onCheckedChange={toggleSelectAllOnPage} aria-label="이 페이지 전체 선택" />
                          </TableHead>
                          <TableHead className="text-center w-28">응답일자</TableHead>
                          <TableHead className="text-center w-28">작성자</TableHead>
                          <TableHead className="text-left">축하 메시지 내용</TableHead>
                          <TableHead className="text-center w-24">청첩장 노출</TableHead>
                          <TableHead className="text-center w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedGuestbook.map((msg) => (
                          <TableRow key={msg.id} className="hover:bg-muted/10 text-xs">
                            <TableCell>
                              <Checkbox
                                checked={selectedGuestbookIds.has(msg.id)}
                                onCheckedChange={() => toggleGuestbookSelection(msg.id)}
                                aria-label="선택"
                              />
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground font-light">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('ko-KR') : '-'}
                            </TableCell>
                            <TableCell className="text-center font-medium">{msg.name}</TableCell>
                            <TableCell className="text-left font-light whitespace-pre-line leading-relaxed max-w-lg">
                              {msg.message}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Switch
                                  checked={msg.is_visible !== false}
                                  onCheckedChange={() => handleToggleVisibility(msg.id, msg.is_visible !== false)}
                                />
                                <span className="text-[10px] text-muted-foreground w-8 text-left">
                                  {msg.is_visible !== false ? '공개' : '숨김'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (confirm('해당 방명록 글을 삭제하시겠습니까?')) {
                                    handleDeleteItem(msg.id, 'guestbook')
                                  }
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </>
                )}
              </CardContent>
              {guestbookTotalPages > 1 && (
                <div className="border-t border-border/30 py-3">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => { e.preventDefault(); setGuestbookPage((p) => Math.max(1, p - 1)) }}
                          className={safeGuestbookPage === 1 ? "pointer-events-none opacity-40" : undefined}
                        />
                      </PaginationItem>
                      {Array.from({ length: guestbookTotalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={page === safeGuestbookPage}
                            onClick={(e) => { e.preventDefault(); setGuestbookPage(page) }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => { e.preventDefault(); setGuestbookPage((p) => Math.min(guestbookTotalPages, p + 1)) }}
                          className={safeGuestbookPage === guestbookTotalPages ? "pointer-events-none opacity-40" : undefined}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Policy Info */}
        <div className="pt-6 border-t border-border/40 text-center font-light space-y-1">
          <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            하객 개인정보 보호 정책: 본 관리 대시보드는 예식일(기준일)로부터 7일 경과 시 접속이 차단되며, 14일 경과 시 모든 수집 정보가 데이터베이스에서 영구 소거됩니다.
          </p>
          <p className="text-[9px] text-muted-foreground">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              개인정보처리방침
            </Link>
            {' · '}© VOW SEOUL. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  )
}
