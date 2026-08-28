'use client'

import { useDocumentTitle } from "@/lib/use-document-title"

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableRowsSkeleton, CardListSkeleton } from '@/components/admin/list-skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useCustomersQuery,
  useDeletedCustomersQuery,
  usePurgeCustomersMutation,
  useDeleteCustomerMutation,
  Customer
} from '@/hooks/queries/useCustomers'
import { CustomerStatusBadge } from '@/components/customer-status-badge'
import { 
  Search, 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  Plus, 
  Download, 
  Users, 
  CheckCircle2, 
  Clock, 
  Edit 
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { logAuditEvent } from '@/lib/audit-log'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'

export default function CustomersPage() {
  useDocumentTitle("고객 관리")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  // 샘플/테스트 고객은 기본 뷰에서 빠지지만, 이 필터를 고르면 그것만 따로 볼 수 있다
  const showingSample = status === 'sample'
  const { data: customerData, isLoading, error } = useCustomersQuery(
    { search, status: showingSample ? 'all' : status, sampleMode: showingSample ? 'only' : 'exclude' },
    page,
    10
  )
  const deleteMutation = useDeleteCustomerMutation()

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ title: '이 고객을 삭제하시겠습니까?', description: 'Soft delete 처리되어 복구 가능합니다.', destructive: true, confirmText: '삭제' }))) return

    try {
      await deleteMutation.mutateAsync(id)
      toast.success('고객이 성공적으로 삭제되었습니다.')
    } catch (err: any) {
      console.error(err)
      toast.error('고객 삭제 중 오류가 발생했습니다.')
    }
  }

  const exportToCSV = () => {
    if (!customerData?.data || customerData.data.length === 0) {
      toast.error('내보낼 데이터가 없습니다.')
      return
    }

    const headers = ['신랑 이름', '신부 이름', '연락처', '예식일', '식장명', '식장 주소', '상태', '등록일']
    const rows = customerData.data.map(c => [
      c.groom_name,
      c.bride_name,
      c.phone || '',
      c.wedding_date || '',
      c.venue_name,
      c.venue_address,
      c.status,
      new Date(c.created_at).toLocaleDateString('ko-KR')
    ])
    
    // Add UTF-8 BOM for Korean support in Excel
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `vowseoul_customers_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('CSV 내보내기가 완료되었습니다.')

    // 개인정보취급자 접속기록 (고시 제8조) — 고객 실명·연락처가 담긴 목록을
    // 파일로 내보냈다는 사실을 남긴다. 청첩장 한 건에 묶이지 않아 invitationId 없이 기록한다.
    supabase.auth.getUser().then(({ data: { user } }) => {
      logAuditEvent(supabase, {
        actorType: 'admin',
        actorLabel: user?.email ?? null,
        action: 'customer_list.exported',
        summary: `고객 목록을 CSV로 내보냈습니다 (${rows.length}건).`,
      })
    })
  }

  // Stats
  const totalCount = customerData?.count || 0
  const customersList = customerData?.data || []

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">고객 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">결혼 고객의 정보 수집 및 진행 단계를 한눈에 확인합니다</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> CSV 내보내기
          </Button>
          <Button asChild className="gap-2">
            <Link href="/admin/customers/new">
              <Plus className="w-4 h-4" /> 신규 고객 등록
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {/* 폰(<640px)에서 1열이면 요약 카드 4장이 세로로 쌓여 정작 고객 목록까지 600px을
          스크롤해야 했다 — 기본을 2열로 둔다 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 고객</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">폼 전송/작성중</CardTitle>
            <Clock className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {customersList.filter(c => c.status === 'form_sent' || c.status === 'draft').length}명
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">청첩장 완료/발행</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {customersList.filter(c => c.status === 'published' || c.status === 'form_completed').length}명
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">만료됨</CardTitle>
            <Clock className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {customersList.filter(c => c.status === 'expired').length}명
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="이름 또는 연락처로 검색..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>
        <Select 
          value={status} 
          onValueChange={(val) => {
            setStatus(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="진행 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="registered">신규 등록 (registered)</SelectItem>
            <SelectItem value="form_sent">폼 전송 (form_sent)</SelectItem>
            <SelectItem value="form_completed">폼 완료 (form_completed)</SelectItem>
            <SelectItem value="draft">초안 작성 (draft)</SelectItem>
            <SelectItem value="published">청첩장 발행 (published)</SelectItem>
            <SelectItem value="expired">만료됨 (expired)</SelectItem>
            <SelectItem value="sample">샘플/테스트</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          {/* 모바일 카드 리스트 — sm 미만에서는 7열 테이블 대신 카드로 보여준다 */}
          <div className="sm:hidden divide-y divide-border">
            {isLoading ? (
              <CardListSkeleton rows={6} />
            ) : error ? (
              <p className="py-8 text-center text-sm text-destructive">데이터를 불러오는 동안 오류가 발생했습니다.</p>
            ) : customersList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">등록된 고객이 없습니다.</p>
            ) : (
              customersList.map((customer) => (
                <div key={customer.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/admin/customers/${customer.id}`} className="text-sm font-semibold text-primary hover:underline">
                      {customer.groom_name !== '미지정' && customer.bride_name && customer.bride_name !== '미지정' ? (
                        `${customer.groom_name} & ${customer.bride_name}`
                      ) : customer.groom_name !== '미지정' ? (
                        <span>{customer.groom_name} (주문자)</span>
                      ) : (
                        <span>{customer.bride_name} (주문자)</span>
                      )}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{customer.phone || '연락처 없음'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {customer.wedding_date || '예식일 미정'}{customer.venue_name ? ` · ${customer.venue_name}` : ''}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <CustomerStatusBadge status={customer.status} />
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(customer.created_at).toLocaleDateString('ko-KR')} 등록
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="더보기">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/customers/${customer.id}`}>
                          <Eye className="w-4 h-4 mr-2" /> 상세보기 / 수정
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(customer.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> 삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>

          {/* 데스크톱/태블릿 테이블 — sm 이상에서만 보인다 */}
          <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>신랑 / 신부</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>예식일시</TableHead>
                <TableHead>예식장</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-24 text-right">등록일</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={7} />
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-destructive">
                    데이터를 불러오는 동안 오류가 발생했습니다.
                  </TableCell>
                </TableRow>
              ) : customersList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    등록된 고객이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                customersList.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/10">
                    <TableCell className="font-medium">
                      <Link href={`/admin/customers/${customer.id}`} className="hover:underline text-primary font-semibold">
                        {customer.groom_name !== '미지정' && customer.bride_name && customer.bride_name !== '미지정' ? (
                          `${customer.groom_name} & ${customer.bride_name}`
                        ) : customer.groom_name !== '미지정' ? (
                          <span>{customer.groom_name} (주문자)</span>
                        ) : (
                          <span>{customer.bride_name} (주문자)</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{customer.phone || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {customer.wedding_date || <span className="text-muted-foreground">미정</span>}
                    </TableCell>
                    <TableCell className="text-sm">{customer.venue_name}</TableCell>
                    <TableCell><CustomerStatusBadge status={customer.status} /></TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">
                      {new Date(customer.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="더보기">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/customers/${customer.id}`}>
                              <Eye className="w-4 h-4 mr-2" /> 상세보기 / 수정
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(customer.id)} 
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > 10 && (
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="outline"
            size="sm"
          >
            이전
          </Button>
          <div className="flex items-center px-4 text-sm text-muted-foreground">
            페이지 {page} / {Math.ceil(totalCount / 10)}
          </div>
          <Button
            onClick={() => setPage(p => (p * 10 < totalCount ? p + 1 : p))}
            disabled={page * 10 >= totalCount}
            variant="outline"
            size="sm"
          >
            다음
          </Button>
        </div>
      )}

      <DeletedCustomersPanel />
    </div>
  )
}

/**
 * 삭제 대기 고객 — 목록에서 지운 고객은 deleted_at 만 찍힌 채 어디에도 보이지 않았다.
 * 되돌릴 수도, 완전히 지울 수도 없어 계속 쌓이기만 했다.
 *
 * 기본은 접혀 있다. 자주 쓰는 기능이 아니고, 되돌릴 수 없는 삭제가 목록 화면에 늘
 * 펼쳐져 있는 것 자체가 위험하다.
 */
function DeletedCustomersPanel() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const { data: deleted = [], isLoading } = useDeletedCustomersQuery(open)
  const purge = usePurgeCustomersMutation()

  const daysSince = (iso: string | null) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handlePurge = async () => {
    const names = deleted.filter((c) => selected.includes(c.id))
      .map((c) => `${c.groom_name ?? ''} & ${c.bride_name ?? ''}`.trim()).join(', ')
    const ok = await confirmDialog({
      title: `${selected.length}명을 완전히 삭제할까요?`,
      description: `${names}

청첩장·폼 응답·하객 데이터까지 함께 지워지며 되돌릴 수 없습니다.`,
      destructive: true,
      confirmText: '완전 삭제',
    })
    if (!ok) return
    try {
      const res = await purge.mutateAsync(selected)
      setSelected([])
      toast.success(`${res.purged}명을 완전히 삭제했습니다.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '완전 삭제에 실패했습니다.')
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-medium">삭제 대기 고객</CardTitle>
            <CardDescription>
              목록에서 삭제한 고객입니다. 아직 데이터가 남아 있어 되돌릴 수 있습니다.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? '접기' : '열기'}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
          ) : deleted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">삭제 대기 중인 고객이 없습니다.</p>
          ) : (
            <>
              <div className="divide-y divide-border rounded-md border">
                {deleted.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                    <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <span className="min-w-0 flex-1 truncate">
                      {c.groom_name || '미지정'} &amp; {c.bride_name || '미지정'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      삭제 후 {daysSince(c.deleted_at)}일
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {selected.length > 0 ? `${selected.length}명 선택됨` : '지울 고객을 선택하세요.'}
                </span>
                <Button
                  variant="outline" size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  disabled={selected.length === 0 || purge.isPending}
                  onClick={handlePurge}
                >
                  {purge.isPending ? '삭제 중…' : '선택 항목 완전 삭제'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
