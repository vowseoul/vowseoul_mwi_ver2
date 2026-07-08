'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { useFieldsQuery, useCreateFieldMutation } from '@/hooks/queries/useForms'
import { Plus, Search, ArrowLeft, Shield, FileCode2, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'

export default function FieldLibraryPage() {
  const { data: fields, isLoading, error } = useFieldsQuery()
  const createMutation = useCreateFieldMutation()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // New Field State
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newHelpText, setNewHelpText] = useState('')
  const [newType, setNewType] = useState<any>('text')
  const [newCategory, setNewCategory] = useState<any>('신랑 정보')
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newKey.trim() || !newLabel.trim()) {
      toast.error('필드 키와 라벨명을 모두 입력해주세요.')
      return
    }

    // Key format validation (lowercase, alphanumeric, underscore)
    const keyRegex = /^[a-z0-9_]+$/
    if (!keyRegex.test(newKey)) {
      toast.error('필드 키는 영문 소문자, 숫자, 언더바(_)만 가능합니다 (예: groom_instagram).')
      return
    }

    setIsSubmitting(true)
    try {
      await createMutation.mutateAsync({
        field_key: newKey,
        label: newLabel,
        help_text: newHelpText || null,
        field_type: newType,
        category: newCategory,
        validation_rules: {},
      })
      toast.success('커스텀 필드가 필드 라이브러리에 추가되었습니다.')
      setIsOpen(false)
      // reset form
      setNewKey('')
      setNewLabel('')
      setNewHelpText('')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '필드 추가 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Categories list for tabs/filters
  const categories = [
    'all',
    '신랑 정보',
    '신부 정보',
    '예식 정보',
    '혼주 정보',
    '계좌 정보',
    '이미지',
    'BGM',
    'RSVP 설정',
    '카카오 공유',
    '영상',
    '지류 전용',
  ]

  const filteredFields = fields?.filter((f) => {
    const matchesSearch = 
      f.label.toLowerCase().includes(search.toLowerCase()) || 
      f.field_key.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || f.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">필드 라이브러리</h1>
            <p className="text-sm text-muted-foreground mt-1">지류 및 모바일 청첩장에 사용되는 모든 공통 입력 항목 데이터 규격을 정의합니다</p>
          </div>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> 커스텀 필드 생성
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>커스텀 필드 추가</DialogTitle>
              <DialogDescription>
                부부로부터 수집해야 할 VOW SEOUL 고유의 정보(예: 식권 색상 등) 규격을 직접 지정합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateField}>
              <FieldGroup className="space-y-4">
                <Field>
                  <FieldLabel htmlFor="newKey">영문 필드 키 (field_key) *</FieldLabel>
                  <Input
                    id="newKey"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="예: groom_instagram"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    소문자, 숫자, 언더바(_)만 가능하며, 중복될 수 없습니다.
                  </p>
                </Field>
                <Field>
                  <FieldLabel htmlFor="newLabel">필드 한글 라벨 *</FieldLabel>
                  <Input
                    id="newLabel"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="예: 신랑 인스타그램 아이디"
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="newType">필드 타입 *</FieldLabel>
                    <Select value={newType} onValueChange={(val: any) => setNewType(val)}>
                      <SelectTrigger id="newType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">텍스트 (단행)</SelectItem>
                        <SelectItem value="textarea">텍스트 영역 (다행)</SelectItem>
                        <SelectItem value="number">숫자</SelectItem>
                        <SelectItem value="select">선택 상자 (select)</SelectItem>
                        <SelectItem value="phone">전화번호</SelectItem>
                        <SelectItem value="date">날짜</SelectItem>
                        <SelectItem value="time">시간</SelectItem>
                        <SelectItem value="address">주소 검색</SelectItem>
                        <SelectItem value="image">이미지 업로드</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="newCategory">카테고리 *</FieldLabel>
                    <Select value={newCategory} onValueChange={(val: any) => setNewCategory(val)}>
                      <SelectTrigger id="newCategory">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="신랑 정보">신랑 정보</SelectItem>
                        <SelectItem value="신부 정보">신부 정보</SelectItem>
                        <SelectItem value="혼주 정보">혼주 정보</SelectItem>
                        <SelectItem value="예식 정보">예식 정보</SelectItem>
                        <SelectItem value="계좌 정보">계좌 정보</SelectItem>
                        <SelectItem value="이미지">이미지</SelectItem>
                        <SelectItem value="BGM">BGM</SelectItem>
                        <SelectItem value="RSVP 설정">RSVP 설정</SelectItem>
                        <SelectItem value="카카오 공유">카카오 공유</SelectItem>
                        <SelectItem value="영상">영상</SelectItem>
                        <SelectItem value="지류 전용">지류 전용</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="newHelpText">안내 문구 (Help Text)</FieldLabel>
                  <Input
                    id="newHelpText"
                    value={newHelpText}
                    onChange={(e) => setNewHelpText(e.target.value)}
                    placeholder="폼 입력 화면에 작게 렌더링될 도움말입니다."
                  />
                </Field>
              </FieldGroup>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                  취소
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  생성하기
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="라벨명 또는 영문 키로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c === 'all' ? '전체 카테고리' : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fields Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>라벨명 / 도움말</TableHead>
                <TableHead>영문 필드 키</TableHead>
                <TableHead>필드 타입</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead className="w-28 text-center">성격</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    필드 라이브러리를 불러오는 중입니다...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-destructive">
                    필드를 불러오는데 오류가 발생했습니다.
                  </TableCell>
                </TableRow>
              ) : filteredFields?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    검색 결과가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFields?.map((field) => (
                  <TableRow key={field.id} className="hover:bg-muted/10">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{field.label}</p>
                        {field.help_text && (
                          <p className="text-xs text-muted-foreground mt-0.5">{field.help_text}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{field.field_key}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {field.field_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{field.category}</TableCell>
                    <TableCell className="text-center">
                      {field.is_system ? (
                        <Badge className="bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1 w-20 mx-auto">
                          <Shield className="w-3 h-3" /> 시스템
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 flex items-center justify-center gap-1 w-20 mx-auto">
                          <FileCode2 className="w-3 h-3" /> 커스텀
                        </Badge>
                      )}
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
