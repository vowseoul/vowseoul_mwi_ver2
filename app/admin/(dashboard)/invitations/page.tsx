'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  useInvitationsQuery, 
  useCreateInvitationMutation, 
  useUpdateInvitationStatusMutation 
} from '@/hooks/queries/useInvitations'
import { useCustomersQuery } from '@/hooks/queries/useCustomers'
import { useThemesQuery } from '@/hooks/queries/useThemes'
import { 
  Plus, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  Edit3, 
  Play, 
  Pause, 
  Loader2, 
  Calendar,
  Sparkles,
  Link2
} from 'lucide-react'
import { toast } from 'sonner'

export default function InvitationsListPage() {
  const { data: invitations, isLoading, error } = useInvitationsQuery()
  const { data: customersData } = useCustomersQuery({ status: 'form_completed' }, 1, 100)
  const { data: themes } = useThemesQuery()

  const createMutation = useCreateInvitationMutation()
  const statusMutation = useUpdateInvitationStatusMutation()

  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [themeId, setThemeId] = useState('')
  const [publicSlug, setPublicSlug] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerId || customerId === 'none') {
      toast.error('고객을 선택해주세요.')
      return
    }
    if (!themeId || themeId === 'none') {
      toast.error('디자인 테마를 선택해주세요.')
      return
    }
    if (!publicSlug.trim()) {
      toast.error('접속 숏링크 주소(slug)를 입력해주세요.')
      return
    }

    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(publicSlug)) {
      toast.error('링크 주소는 영문 소문자, 숫자, 하이픈(-)만 허용됩니다.')
      return
    }

    setIsCreating(true)
    try {
      const created = await createMutation.mutateAsync({
        customerId,
        themeId,
        publicSlug,
      })
      toast.success('신규 모바일 청첩장 초안이 성공적으로 생성되었습니다.')
      setIsOpen(false)
      // Reset form
      setCustomerId('')
      setThemeId('')
      setPublicSlug('')
      
      // Redirect to the client-side editor
      window.location.href = `/editor/${created.id}`
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '초안 생성에 실패했습니다.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleStatusChange = async (invitationId: string, status: any) => {
    try {
      await statusMutation.mutateAsync({ invitationId, status })
      toast.success(`청첩장 상태가 ${status === 'published' ? '발행(공개)' : '일시정지'} 상태로 변경되었습니다.`)
    } catch (err: any) {
      console.error(err)
      toast.error('상태 변경 실패')
    }
  }

  const handleCopyLink = (slug: string, id: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    navigator.clipboard.writeText(`${baseUrl}/w/${slug}`)
    setCopiedId(id)
    toast.success('하객용 청첩장 주소가 클립보드에 복사되었습니다.')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredInvitations = invitations?.filter((inv) => {
    const names = `${inv.customer?.groom_name} ${inv.customer?.bride_name}`.toLowerCase()
    return names.includes(search.toLowerCase()) || inv.public_slug.toLowerCase().includes(search.toLowerCase())
  })

  const availableCustomers = customersData?.data || []
  const availableThemes = themes || []

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">모바일 청첩장 제작 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">고객 정보 수집 완료 후, 청첩장 초안을 제작하고 발행 상태를 모니터링합니다</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> 신규 청첩장 생성
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>새 모바일 청첩장 제작</DialogTitle>
              <DialogDescription>
                정보 입력이 완료된 고객의 데이터와 디자인 테마를 결합하여 제작을 개시합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <FieldGroup className="space-y-4">
                {/* Customer selection */}
                <Field>
                  <FieldLabel htmlFor="customerSelect">정보 입력 완료 고객 *</FieldLabel>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger id="customerSelect">
                      <SelectValue placeholder="제작을 시작할 고객 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">고객 선택</SelectItem>
                      {availableCustomers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.groom_name} & {c.bride_name} (예식일: {c.wedding_date})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Theme selection */}
                <Field>
                  <FieldLabel htmlFor="themeSelect">기본 디자인 테마 *</FieldLabel>
                  <Select value={themeId} onValueChange={setThemeId}>
                    <SelectTrigger id="themeSelect">
                      <SelectValue placeholder="디자인 테마 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">테마 선택</SelectItem>
                      {availableThemes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Public Slug */}
                <Field>
                  <FieldLabel htmlFor="publicSlug">하객 접속 링크 (Slug) *</FieldLabel>
                  <Input
                    id="publicSlug"
                    value={publicSlug}
                    onChange={(e) => setPublicSlug(e.target.value)}
                    placeholder="예: minsu-jiwon-wedding"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    하객들에게 제공될 고유 링크 주소입니다. (영문 소문자, 숫자, 하이픈만 가능)
                  </p>
                </Field>
              </FieldGroup>
              <DialogFooter className="mt-6 pt-6 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isCreating}>
                  취소
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  제작 및 편집기 열기
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search */}
      <div className="flex">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="고객 이름 또는 링크 주소로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Invitations List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>신랑 & 신부</TableHead>
                <TableHead>접속 링크 (Slug)</TableHead>
                <TableHead className="text-center">상태</TableHead>
                <TableHead>예식 예정일</TableHead>
                <TableHead className="text-center">하객 링크</TableHead>
                <TableHead className="w-24 text-right">관리 액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    청첩장 목록을 로딩 중입니다...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-destructive">
                    목록 조회 중 오류가 발생했습니다.
                  </TableCell>
                </TableRow>
              ) : filteredInvitations?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    제작중인 청첩장이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvitations?.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/10">
                    <TableCell>
                      <div className="font-semibold text-sm">
                        {inv.customer?.groom_name} & {inv.customer?.bride_name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      /w/{inv.public_slug}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={
                          inv.status === 'published' 
                            ? 'default' 
                            : inv.status === 'draft' 
                            ? 'secondary' 
                            : 'destructive'
                        }
                      >
                        {inv.status === 'published' 
                          ? '공개중' 
                          : inv.status === 'draft' 
                          ? '초안작성' 
                          : inv.status === 'paused' 
                          ? '정지' 
                          : '만료'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {inv.customer?.wedding_date || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8"
                        onClick={() => handleCopyLink(inv.public_slug, inv.id)}
                      >
                        {copiedId === inv.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Link2 className="w-3.5 h-3.5" />}
                        <span className="ml-1 text-[11px]">복사</span>
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" asChild className="h-8 text-[11px] gap-1">
                          <Link href={`/editor/${inv.id}`}>
                            <Edit3 className="w-3.5 h-3.5" /> 편집
                          </Link>
                        </Button>
                        
                        {inv.status === 'published' ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-[11px] text-amber-600 hover:text-amber-700"
                            onClick={() => handleStatusChange(inv.id, 'paused')}
                          >
                            <Pause className="w-3.5 h-3.5" /> 정지
                          </Button>
                        ) : (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="h-8 text-[11px]"
                            onClick={() => handleStatusChange(inv.id, 'published')}
                          >
                            <Play className="w-3.5 h-3.5" /> 공개
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
