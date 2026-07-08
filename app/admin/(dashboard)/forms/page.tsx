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
import { useFormTemplatesQuery, useCreateFormTemplateMutation } from '@/hooks/queries/useForms'
import { FileText, Plus, Search, Edit2, Copy, Trash2, ArrowLeft, Settings, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'

export default function FormTemplatesPage() {
  const { data: templates, isLoading, error } = useFormTemplatesQuery()
  const createMutation = useCreateFormTemplateMutation()

  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('클래식 화이트 라인')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !category.trim()) {
      toast.error('템플릿 이름과 지류 청첩장 카테고리를 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      await createMutation.mutateAsync({
        name,
        description: description || null,
        category,
        is_active: true,
      })
      toast.success('신규 폼 템플릿이 성공적으로 등록되었습니다.')
      setIsOpen(false)
      setName('')
      setDescription('')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '폼 템플릿 생성 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredTemplates = templates?.filter((t) => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  )

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
            <h1 className="text-2xl font-semibold text-foreground">정보 수집 폼 관리</h1>
            <p className="text-sm text-muted-foreground mt-1">지류 청첩장 라인업별 고객용 정보 수집 폼 템플릿을 생성하고 설계합니다</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/admin/forms/fields">
              <Settings className="w-4 h-4" /> 필드 라이브러리
            </Link>
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> 템플릿 생성
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>새 폼 템플릿 생성</DialogTitle>
                <DialogDescription>
                  특정 지류 청첩장 주문 고객에게 제공될 정보 수집 양식을 만듭니다.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTemplate}>
                <FieldGroup className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="name">템플릿명 *</FieldLabel>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: 리본 장식 클래식 화이트형"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="category">지류 청첩장 제품군 카테고리 *</FieldLabel>
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="예: 클래식 화이트 라인"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="description">상세 설명</FieldLabel>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="템플릿에 대한 설명을 간략히 적어주세요."
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter className="mt-6 pt-6 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                    취소
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    생성하기
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="템플릿명 또는 제품군으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Templates List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>템플릿 정보</TableHead>
                <TableHead>제품군 카테고리</TableHead>
                <TableHead className="text-center">버전</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-24 text-right">등록일</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    폼 템플릿을 불러오는 중입니다...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-destructive">
                    템플릿 로딩 중 오류가 발생했습니다.
                  </TableCell>
                </TableRow>
              ) : filteredTemplates?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    등록된 폼 템플릿이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates?.map((template) => (
                  <TableRow key={template.id} className="hover:bg-muted/10">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{template.category}</TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      v{template.current_version}
                    </TableCell>
                    <TableCell>
                      {template.is_active ? (
                        <Badge variant="default">활성</Badge>
                      ) : (
                        <Badge variant="secondary">비활성</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">
                      {new Date(template.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/forms/builder/${template.id}`} className="gap-1.5">
                          <Edit2 className="w-3.5 h-3.5" /> 폼 빌더
                        </Link>
                      </Button>
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
