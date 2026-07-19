'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useAppStore, sampleOrders, type Order, sampleThemes } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Search, CalendarIcon, Eye, Plus, Settings, MoreVertical, Link2, Pencil, Copy, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'

export default function OrdersPage() {
  const router = useRouter()
  const { orders, setOrders, updateOrder, themes } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [sortField, setSortField] = useState<'id' | 'createdAt' | 'groomName' | 'weddingDate' | 'amount' | 'status'>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Action Loading & Edit Dialog States
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null)
  const [editForm, setEditForm] = useState<{
    id: string
    createdAt: string
    groomName: string
    brideName: string
    weddingDate: string
    theme: string
    amount: number
    status: Order['status']
  }>({
    id: '',
    createdAt: '',
    groomName: '',
    brideName: '',
    weddingDate: '',
    theme: '',
    amount: 0,
    status: 'pending'
  })

  const [invitationThemes, setInvitationThemes] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchInvitationThemes = async () => {
      if (!orders || orders.length === 0) return
      
      const invitationIds = orders.map(o => o.invitationId).filter(Boolean)
      if (invitationIds.length === 0) return

      // Step 1: Fetch invitations to get theme_version_id
      const { data: invs, error: invsError } = await supabase
        .from('invitations')
        .select('id, theme_version_id')
        .in('id', invitationIds)

      if (invsError) {
        console.error('Error fetching invitations:', invsError)
        return
      }

      if (!invs || invs.length === 0) return

      // Step 2: Fetch theme_versions to map theme_version_id -> theme_id
      const versionIds = invs.map(i => i.theme_version_id).filter(Boolean)
      
      const themeIdMap: Record<string, string> = {}
      if (versionIds.length > 0) {
        const { data: versions, error: versionsError } = await supabase
          .from('theme_versions')
          .select('id, theme_id')
          .in('id', versionIds)

        if (versionsError) {
          console.error('Error fetching theme versions:', versionsError)
        } else if (versions) {
          versions.forEach((v: any) => {
            themeIdMap[v.id] = v.theme_id
          })
        }
      }

      // Step 3: Construct the final map of invitationId -> theme_id
      const themeMap: Record<string, string> = {}
      invs.forEach((item: any) => {
        const versionId = item.theme_version_id
        themeMap[item.id] = (versionId ? themeIdMap[versionId] : null) || 'classic-white'
      })
      setInvitationThemes(themeMap)
    }

    fetchInvitationThemes()
  }, [orders])

  // Action Handlers
  const handleCopyLink = async (invitationId: string) => {
    if (!invitationId) {
      toast.error('청첩장 ID가 유효하지 않습니다.')
      return
    }
    const url = `${window.location.origin}/invitation/${invitationId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('청첩장 링크가 클립보드에 복사되었습니다.')
    } catch (err) {
      toast.error('링크 복사에 실패했습니다.')
    }
  }

  const handleCopyDashboardLink = async (invitationId: string) => {
    if (!invitationId) {
      toast.error('청첩장 ID가 유효하지 않습니다.')
      return
    }
    const url = `${window.location.origin}/invitation/${invitationId}/dashboard`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('고객 대시보드 링크가 클립보드에 복사되었습니다.')
    } catch (err) {
      toast.error('대시보드 링크 복사에 실패했습니다.')
    }
  }

  const handleOpenEditDialog = (order: Order) => {
    setSelectedOrderForEdit(order)
    setEditForm({
      id: order.id,
      createdAt: order.createdAt,
      groomName: order.groomName,
      brideName: order.brideName,
      weddingDate: order.weddingDate,
      theme: order.theme,
      amount: order.amount,
      status: order.status
    })
    setIsEditDialogOpen(true)
  }

  const handleSaveOrderDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrderForEdit) return

    if (!editForm.id.trim()) {
      toast.error('주문번호를 입력해주세요.')
      return
    }

    setIsActionLoading(selectedOrderForEdit.id)
    try {
      // 1. If Order ID has changed, check if new ID already exists
      if (editForm.id !== selectedOrderForEdit.id) {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('id', editForm.id)
          .maybeSingle()

        if (existingOrder) {
          toast.error('이미 존재하는 주문번호입니다.')
          setIsActionLoading(null)
          return
        }
      }

      const availableThemes = themes.length > 0 ? themes : sampleThemes
      const matchedTheme = availableThemes.find(t => t.name === editForm.theme) || 
                            availableThemes[0] || 
                            { id: 'classic-white', name: 'Classic White' }

      // 2. Update Order details in DB
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          id: editForm.id,
          createdAt: editForm.createdAt,
          groomName: editForm.groomName,
          brideName: editForm.brideName,
          weddingDate: editForm.weddingDate,
          theme: editForm.theme,
          amount: editForm.amount,
          status: editForm.status
        })
        .eq('id', selectedOrderForEdit.id)

      if (orderError) throw orderError

      // 3. Update Invitation details in DB to sync
      if (selectedOrderForEdit.invitationId) {
        const { error: inviteError } = await supabase
          .from('invitations')
          .update({
            groomName: editForm.groomName,
            brideName: editForm.brideName,
            weddingDate: editForm.weddingDate,
            themeId: matchedTheme.id
          })
          .eq('id', selectedOrderForEdit.invitationId)

        if (inviteError) throw inviteError
      }

      // 4. Update Zustand store
      const updatedOrder: Order = {
        ...selectedOrderForEdit,
        id: editForm.id,
        createdAt: editForm.createdAt,
        groomName: editForm.groomName,
        brideName: editForm.brideName,
        weddingDate: editForm.weddingDate,
        theme: editForm.theme,
        amount: editForm.amount,
        status: editForm.status
      }

      setOrders(orders.map(o => o.id === selectedOrderForEdit.id ? updatedOrder : o))
      setIsEditDialogOpen(false)
      toast.success('주문 정보 및 청첩장이 정상적으로 수정되었습니다.')
    } catch (err: any) {
      console.error('Error saving order details:', err)
      toast.error(err.message || '수정 중 오류가 발생했습니다.')
    } finally {
      setIsActionLoading(null)
    }
  }

  const handleDuplicateOrder = async (order: Order) => {
    setIsActionLoading(order.id)
    try {
      // 1. Fetch current invitation data
      const { data: invitation, error: inviteFetchError } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', order.invitationId)
        .single()

      if (inviteFetchError) throw inviteFetchError
      if (!invitation) throw new Error('청첩장을 찾을 수 없습니다.')

      // 2. Generate new invitation ID
      const randId = typeof window !== 'undefined' && window.crypto?.randomUUID 
        ? window.crypto.randomUUID() 
        : 'inv-admin-' + Math.random().toString(36).substring(2, 15)
      const newInvitationId = `custom__${randId}`

      // 3. Copy invitation data with new ID
      const newInvitation = {
        ...invitation,
        id: newInvitationId,
        createdAt: new Date().toISOString(),
        status: 'draft'
      }

      const { error: inviteInsertError } = await supabase
        .from('invitations')
        .insert(newInvitation)

      if (inviteInsertError) throw inviteInsertError

      // 4. Generate new order ID
      const newOrderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000)

      // 5. Copy order data
      const newOrder: Order = {
        ...order,
        id: newOrderId,
        invitationId: newInvitationId,
        customerName: `${order.customerName} (복사본)`,
        status: 'pending',
        createdAt: new Date().toISOString().split('T')[0]
      }

      const { error: orderInsertError } = await supabase
        .from('orders')
        .insert(newOrder)

      if (orderInsertError) throw orderInsertError

      // 6. Update local store
      setOrders([...orders, newOrder])
      toast.success('청첩장과 주문 정보가 성공적으로 복사되었습니다.')
    } catch (err: any) {
      console.error('Error duplicating order/invitation:', err)
      toast.error('복사 중 오류가 발생했습니다.')
    } finally {
      setIsActionLoading(null)
    }
  }

  const handleDeleteOrder = async (orderId: string, invitationId: string) => {
    if (!confirm('정말로 이 청첩장과 주문 정보를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) {
      return
    }

    setIsActionLoading(orderId)
    try {
      // 1. Delete Order from DB
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      if (orderError) throw orderError

      // 2. Delete Invitation from DB
      if (invitationId) {
        const { error: inviteError } = await supabase
          .from('invitations')
          .delete()
          .eq('id', invitationId)

        if (inviteError) throw inviteError
      }

      // 3. Update local store
      setOrders(orders.filter(o => o.id !== orderId))
      toast.success('주문과 청첩장이 성공적으로 삭제되었습니다.')
    } catch (err: any) {
      console.error('Error deleting order/invitation:', err)
      toast.error('삭제 중 오류가 발생했습니다.')
    } finally {
      setIsActionLoading(null)
    }
  }

  const filteredOrders = orders.filter(order => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!order.groomName.toLowerCase().includes(query) && 
          !order.brideName.toLowerCase().includes(query)) {
        return false
      }
    }
    // Status filter
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false
    }
    // Date range filter
    if (dateRange.from) {
      const orderDate = new Date(order.weddingDate)
      if (orderDate < dateRange.from) return false
    }
    if (dateRange.to) {
      const orderDate = new Date(order.weddingDate)
      if (orderDate > dateRange.to) return false
    }
    return true
  })

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aVal: any = a[sortField] || ''
    let bVal: any = b[sortField] || ''

    if (sortField === 'groomName') {
      aVal = `${a.groomName} & ${a.brideName}`.toLowerCase()
      bVal = `${b.groomName} & ${b.brideName}`.toLowerCase()
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const handleStatusChange = (orderId: string, newStatus: Order['status']) => {
    updateOrder(orderId, { status: newStatus })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">주문 관리</h1>
          <p className="text-muted-foreground">청첩장 주문 내역을 조회하고 관리합니다.</p>
        </div>
        <Button asChild>
          <Link href="/admin/orders/create">
            <Plus className="mr-2 h-4 w-4" />
            청첩장 추가하기
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="신랑/신부명으로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="pending">대기중</SelectItem>
                <SelectItem value="paid">결제완료</SelectItem>
                <SelectItem value="deployed">배포중</SelectItem>
                <SelectItem value="expired">만료됨</SelectItem>
                <SelectItem value="refunded">환불</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(
                  'min-w-[200px] justify-start text-left font-normal',
                  !dateRange.from && 'text-muted-foreground'
                )}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MM/dd', { locale: ko })} -{' '}
                        {format(dateRange.to, 'MM/dd', { locale: ko })}
                      </>
                    ) : (
                      format(dateRange.from, 'PPP', { locale: ko })
                    )
                  ) : (
                    '예식일 범위'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange as any}
                  onSelect={(range: any) => setDateRange(range || {})}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {(searchQuery || statusFilter !== 'all' || dateRange.from) && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                  setDateRange({})
                }}
              >
                필터 초기화
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">주문 목록 ({sortedOrders.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted-foreground select-none">
                  <th 
                    className="pb-3 pr-4 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center gap-1">
                      <span>주문번호</span>
                      {sortField === 'id' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="pb-3 pr-4 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      <span>주문일시</span>
                      {sortField === 'createdAt' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="pb-3 pr-4 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('groomName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>신랑신부</span>
                      {sortField === 'groomName' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="pb-3 pr-4 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('weddingDate')}
                  >
                    <div className="flex items-center gap-1">
                      <span>예식일</span>
                      {sortField === 'weddingDate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </th>
                  <th className="pb-3 pr-4">테마</th>
                  <th 
                    className="pb-3 pr-4 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center gap-1">
                      <span>금액</span>
                      {sortField === 'amount' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="pb-3 pr-4 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      <span>상태</span>
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </th>
                  <th className="pb-3">관리</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-sm font-medium">{order.id}</td>
                    <td className="py-3 pr-4 text-sm">{order.createdAt}</td>
                    <td className="py-3 pr-4 text-sm">
                      {order.groomName} & {order.brideName}
                    </td>
                    <td className="py-3 pr-4 text-sm">{order.weddingDate}</td>
                    <td className="py-3 pr-4 text-sm">
                      {(() => {
                        const actualThemeId = invitationThemes[order.invitationId]
                        const matchedTheme = actualThemeId ? (themes.find(t => t.id === actualThemeId) || sampleThemes.find(t => t.id === actualThemeId)) : null
                        return matchedTheme ? matchedTheme.name : order.theme
                      })()}
                    </td>
                    <td className="py-3 pr-4 text-sm">{order.amount.toLocaleString()}원</td>
                    <td className="py-3 pr-4">
                      <Select
                        value={order.status}
                        onValueChange={(value: Order['status']) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="h-8 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">대기중</SelectItem>
                          <SelectItem value="paid">결제완료</SelectItem>
                          <SelectItem value="deployed">배포중</SelectItem>
                          <SelectItem value="expired">만료됨</SelectItem>
                          <SelectItem value="refunded">환불</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-1">
                            {isActionLoading === order.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Settings className="h-3.5 w-3.5" />
                            )}
                            <span>관리</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/orders/${order.id}`} className="cursor-pointer flex items-center gap-2 w-full">
                              <Pencil className="h-4 w-4" />
                              <span>청첩장 수정하기</span>
                            </Link>
                          </DropdownMenuItem>
                           <DropdownMenuItem 
                            onClick={() => handleCopyLink(order.invitationId)}
                            className="cursor-pointer flex items-center gap-2 w-full"
                          >
                            <Link2 className="h-4 w-4" />
                            <span>링크 복사하기</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleCopyDashboardLink(order.invitationId)}
                            className="cursor-pointer flex items-center gap-2 w-full"
                          >
                            <Copy className="h-4 w-4" />
                            <span>대시보드 링크 복사</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleOpenEditDialog(order)}
                            className="cursor-pointer flex items-center gap-2 w-full"
                          >
                            <Settings className="h-4 w-4" />
                            <span>주문 내역 수정</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDuplicateOrder(order)}
                            className="cursor-pointer flex items-center gap-2 w-full"
                          >
                            <Copy className="h-4 w-4" />
                            <span>청첩장 복사하기</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteOrder(order.id, order.invitationId)}
                            className="cursor-pointer text-destructive focus:bg-destructive/10 dark:focus:bg-destructive/20 focus:text-destructive flex items-center gap-2 w-full"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>청첩장 삭제하기</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      조건에 맞는 주문이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 주문 내역 수정 Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md bg-background border border-border p-6 rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">주문 내역 직접 수정</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              선택한 주문 내역을 직접 편집합니다. 신랑/신부명, 예식일, 테마는 청첩장 내용에도 자동으로 동기화됩니다.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveOrderDetails} className="space-y-4 pt-4">
            <FieldGroup className="space-y-4">
              <Field>
                <FieldLabel htmlFor="edit-id" className="text-sm font-medium">주문번호</FieldLabel>
                <Input
                  id="edit-id"
                  value={editForm.id}
                  onChange={(e) => setEditForm({ ...editForm, id: e.target.value })}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-createdAt" className="text-sm font-medium">주문일시</FieldLabel>
                <Input
                  id="edit-createdAt"
                  value={editForm.createdAt}
                  onChange={(e) => setEditForm({ ...editForm, createdAt: e.target.value })}
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="edit-groomName" className="text-sm font-medium">신랑 이름</FieldLabel>
                  <Input
                    id="edit-groomName"
                    value={editForm.groomName}
                    onChange={(e) => setEditForm({ ...editForm, groomName: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-brideName" className="text-sm font-medium">신부 이름</FieldLabel>
                  <Input
                    id="edit-brideName"
                    value={editForm.brideName}
                    onChange={(e) => setEditForm({ ...editForm, brideName: e.target.value })}
                    required
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="edit-weddingDate" className="text-sm font-medium">예식일</FieldLabel>
                <Input
                  id="edit-weddingDate"
                  type="date"
                  value={editForm.weddingDate}
                  onChange={(e) => setEditForm({ ...editForm, weddingDate: e.target.value })}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-theme" className="text-sm font-medium">테마</FieldLabel>
                <Select
                  value={editForm.theme}
                  onValueChange={(val) => setEditForm({ ...editForm, theme: val })}
                >
                  <SelectTrigger id="edit-theme" className="w-full">
                    <SelectValue placeholder="테마 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {(themes && themes.length > 0 ? themes : sampleThemes).map((theme) => (
                      <SelectItem key={theme.id} value={theme.name}>
                        {theme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="edit-amount" className="text-sm font-medium">금액 (원)</FieldLabel>
                  <Input
                    id="edit-amount"
                    type="number"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: parseInt(e.target.value) || 0 })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-status" className="text-sm font-medium">상태</FieldLabel>
                  <Select
                    value={editForm.status}
                    onValueChange={(val: Order['status']) => setEditForm({ ...editForm, status: val })}
                  >
                    <SelectTrigger id="edit-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">대기중</SelectItem>
                      <SelectItem value="paid">결제완료</SelectItem>
                      <SelectItem value="deployed">배포중</SelectItem>
                      <SelectItem value="expired">만료됨</SelectItem>
                      <SelectItem value="refunded">환불</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                취소
              </Button>
              <Button type="submit" className="text-white bg-foreground hover:bg-foreground/90">
                저장하기
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
