'use client'

import React, { useState, useMemo } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { 
  useFormTemplatesQuery, 
  useCreateFormTemplateMutation,
  useUpdateFormTemplateMutation,
  useDeleteFormTemplateMutation,
  useFormTemplateFieldsQuery
} from '@/hooks/queries/useForms'
import { FileText, Plus, Search, Edit2, Copy, Trash2, ArrowLeft, Settings, LayoutGrid, Eye, Edit, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function FormTemplatesPage() {
  const { data: templates, isLoading, error } = useFormTemplatesQuery()
  const createMutation = useCreateFormTemplateMutation()
  const updateMutation = useUpdateFormTemplateMutation()
  const deleteMutation = useDeleteFormTemplateMutation()

  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('클래식 화이트 라인')
  const [includesMobile, setIncludesMobile] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit Template States
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIncludesMobile, setEditIncludesMobile] = useState(false)

  // Preview States
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewStep, setPreviewStep] = useState(0)
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({})

  // Fetch fields for preview
  const { data: previewFields, isLoading: isLoadingPreviewFields } = useFormTemplateFieldsQuery(previewTemplateId || '')

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !category.trim()) {
      toast.error('템플릿 이름과 지류 청첩장 카테고리를 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const descPayload = includesMobile ? `[모바일포함] ${description}` : description
      await createMutation.mutateAsync({
        name,
        description: descPayload || null,
        category,
        is_active: true,
      })
      toast.success('신규 폼 템플릿이 성공적으로 등록되었습니다.')
      setIsOpen(false)
      setName('')
      setDescription('')
      setIncludesMobile(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '폼 템플릿 생성 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (template: any) => {
    setEditingTemplate(template)
    setEditName(template.name)
    setEditCategory(template.category)
    const isMobile = template.description?.includes('[모바일포함]')
    setEditIncludesMobile(!!isMobile)
    setEditDescription(template.description?.replace('[모바일포함]', '').trim() || '')
    setIsEditOpen(true)
  }

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim() || !editCategory.trim()) {
      toast.error('템플릿 이름과 지류 청첩장 카테고리를 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const descPayload = editIncludesMobile ? `[모바일포함] ${editDescription}`.trim() : editDescription.trim()
      await updateMutation.mutateAsync({
        templateId: editingTemplate.id,
        updates: {
          name: editName,
          category: editCategory,
          description: descPayload || null,
        }
      })
      toast.success('템플릿 정보가 성공적으로 수정되었습니다.')
      setIsEditOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '템플릿 수정 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper to parse options
  const parseOptions = (field: any) => {
    if (!field.options) return {}
    if (typeof field.options === 'string') {
      try {
        return JSON.parse(field.options)
      } catch {
        return {}
      }
    }
    return field.options
  }

  const renderPreviewInputField = (field: any) => {
    const value = previewValues[field.field_key] || ''
    const handlePreviewInputChange = (key: string, val: any) => {
      setPreviewValues(prev => ({ ...prev, [key]: val }))
    }

    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handlePreviewInputChange(field.field_key, e.target.value)}
            placeholder={field.help_text || '내용을 입력하세요.'}
            required={field.is_required}
            className="text-xs"
          />
        )
      case 'select': {
        const opts = parseOptions(field)
        const choices = opts.choices || []
        return (
          <Select
            value={value}
            onValueChange={(val) => handlePreviewInputChange(field.field_key, val)}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((opt: string) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      case 'rselect': {
        const opts = parseOptions(field)
        const choices = opts.choices || []
        return (
          <div className="grid grid-cols-2 gap-2">
            {choices.map((opt: string) => {
              const id = `preview-${field.field_key}-${opt}`
              const isChecked = value === opt
              return (
                <label
                  key={opt}
                  htmlFor={id}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    isChecked
                      ? 'border-primary bg-primary/5 font-semibold text-primary'
                      : 'border-border bg-card hover:bg-muted/10'
                  }`}
                >
                  <input
                    type="radio"
                    id={id}
                    name={`preview-${field.field_key}`}
                    value={opt}
                    checked={isChecked}
                    onChange={() => handlePreviewInputChange(field.field_key, opt)}
                    className="w-4 h-4 text-primary focus:ring-primary border-slate-300"
                  />
                  <span>{opt}</span>
                </label>
              )
            })}
            {choices.length === 0 && (
              <p className="text-xs text-muted-foreground italic">선택할 수 있는 항목이 없습니다.</p>
            )}
          </div>
        )
      }
      case 'toggle': {
        const isToggled = value === true || value === 'true' || value === 'on' || value === '예'
        return (
          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={isToggled}
              onCheckedChange={(checked) => handlePreviewInputChange(field.field_key, checked ? '예' : '아니오')}
            />
            <span className="text-xs font-medium text-slate-700">
              {isToggled ? '예' : '아니오'}
            </span>
          </div>
        )
      }
      case 'image':
        return (
          <div className="space-y-2">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onloadend = () => {
                    handlePreviewInputChange(field.field_key, reader.result)
                  }
                  reader.readAsDataURL(file)
                }
              }}
              required={field.is_required}
              className="text-xs"
            />
            {value && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Preview" className="h-24 object-cover rounded-lg border border-border" />
            )}
          </div>
        )
      case 'images': {
        const imageArray = Array.isArray(value) ? value : (value ? [value] : [])
        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = e.target.files
          if (!files) return
          
          const newImages = [...imageArray]
          let loadedCount = 0
          Array.from(files).forEach((file) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              newImages.push(reader.result as string)
              loadedCount++
              if (loadedCount === files.length) {
                handlePreviewInputChange(field.field_key, newImages)
              }
            }
            reader.readAsDataURL(file)
          })
        }
        const handleRemoveImage = (index: number) => {
          const updated = imageArray.filter((_, i) => i !== index)
          handlePreviewInputChange(field.field_key, updated)
        }
        return (
          <div className="space-y-3">
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              required={field.is_required && imageArray.length === 0}
              className="text-xs"
            />
            {imageArray.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {imageArray.map((imgUrl: string, idx: number) => (
                  <div key={idx} className="relative aspect-square border border-border rounded-lg overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt={`Uploaded ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] shadow"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }
      default:
        return (
          <Input
            type={field.field_type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => handlePreviewInputChange(field.field_key, e.target.value)}
            placeholder={field.help_text || '내용을 입력하세요.'}
            required={field.is_required}
            className="text-xs"
          />
        )
    }
  }

  // Compute steps for preview template
  const previewFieldsSnapshot = useMemo(() => {
    return previewFields?.map((tf: any) => ({
      field_library_id: tf.field_library_id,
      field_key: tf.field_library?.field_key,
      label: tf.label_override || tf.field_library?.label || '',
      help_text: tf.help_text_override || tf.field_library?.help_text,
      field_type: tf.field_library?.field_type,
      is_required: tf.is_required,
      options: tf.options,
    })) || []
  }, [previewFields])

  const { stepKeys, currentStepKey, currentFields } = useMemo(() => {
    const stepsMap: Record<string, any[]> = {}
    previewFieldsSnapshot.forEach((field: any) => {
      const opts = parseOptions(field)
      const pageName = opts.page_title?.trim() || field.category || '기타 정보'
      if (!stepsMap[pageName]) {
        stepsMap[pageName] = []
      }
      stepsMap[pageName].push(field)
    })
    const keys = Object.keys(stepsMap)
    const key = keys[previewStep] || ''
    const fields = stepsMap[key] || []
    return { stepKeys: keys, currentStepKey: key, currentFields: fields }
  }, [previewFieldsSnapshot, previewStep])

  const handlePreviewNext = () => {
    const missing = currentFields.filter(f => {
      if (!f.is_required) return false
      const opts = parseOptions(f)
      if (opts.parent_field_key) {
        let parentVal = (previewValues[opts.parent_field_key] || '').toString().trim()
        if (parentVal === 'true') parentVal = '예'
        if (parentVal === 'false') parentVal = '아니오'
        const triggerVal = (opts.parent_trigger_option || '').toString().trim()
        if (parentVal !== triggerVal) return false
      }
      return !previewValues[f.field_key] || previewValues[f.field_key].toString().trim() === ''
    })

    if (missing.length > 0) {
      toast.error(`입력하지 않은 필수 항목이 있습니다: ${missing.map(m => m.label).join(', ')}`)
      return
    }

    if (previewStep < stepKeys.length - 1) {
      setPreviewStep(s => s + 1)
    }
  }

  const handlePreviewSubmit = () => {
    const allMissing: string[] = []
    previewFieldsSnapshot.forEach((f: any) => {
      if (!f.is_required) return
      const opts = parseOptions(f)
      if (opts.parent_field_key) {
        let parentVal = (previewValues[opts.parent_field_key] || '').toString().trim()
        if (parentVal === 'true') parentVal = '예'
        if (parentVal === 'false') parentVal = '아니오'
        const triggerVal = (opts.parent_trigger_option || '').toString().trim()
        if (parentVal !== triggerVal) return
      }
      if (!previewValues[f.field_key] || previewValues[f.field_key].toString().trim() === '') {
        allMissing.push(f.label)
      }
    })

    if (allMissing.length > 0) {
      toast.error(`입력하지 않은 필수 항목이 있습니다: ${allMissing.join(', ')}`)
      return
    }

    toast.success('🎉 [미리보기 성공] 모든 입력값 검증이 완료되었습니다! (실제 제출은 되지 않습니다.)')
    setIsPreviewOpen(false)
  }

  const handleToggleActive = async (templateId: string, currentActive: boolean) => {
    try {
      await updateMutation.mutateAsync({
        templateId,
        updates: { is_active: !currentActive }
      })
      toast.success(`템플릿이 ${!currentActive ? '활성화' : '비활성화'}되었습니다.`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '상태 변경 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('이 폼 템플릿을 정말로 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) {
      return
    }

    try {
      await deleteMutation.mutateAsync(templateId)
      toast.success('폼 템플릿이 삭제되었습니다.')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '템플릿 삭제 중 오류가 발생했습니다. (고객에게 발행된 인스턴스가 존재할 수 있습니다.)')
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
                  <Field className="flex items-center justify-between bg-muted/20 p-2.5 rounded-lg border border-border mt-2">
                    <div>
                      <FieldLabel htmlFor="includesMobile" className="text-xs font-semibold">모바일 청첩장 제작 포함</FieldLabel>
                      <p className="text-[10px] text-muted-foreground mt-0.5">이 설문 양식이 모바일 청첩장 데이터 수집도 포함하는지 여부</p>
                    </div>
                    <Switch
                      id="includesMobile"
                      checked={includesMobile}
                      onCheckedChange={setIncludesMobile}
                      className="scale-90 shrink-0"
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
                <TableHead className="min-w-[200px]">템플릿 정보</TableHead>
                <TableHead className="w-[180px]">제품군 카테고리</TableHead>
                <TableHead className="w-[80px] text-center">버전</TableHead>
                <TableHead className="w-[100px]">상태</TableHead>
                <TableHead className="w-[120px] text-right">등록일</TableHead>
                <TableHead className="w-[320px] text-right pr-6">관리 작업</TableHead>
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
                        <p className="font-medium text-sm flex items-center gap-2">
                          {template.name}
                          {template.description?.includes('[모바일포함]') ? (
                            <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 text-[10px] scale-90 px-1.5 py-0 h-4">
                              모바일 포함
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 text-[10px] scale-90 px-1.5 py-0 h-4">
                              지류 단독
                            </Badge>
                          )}
                        </p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {template.description.replace('[모바일포함]', '').trim()}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{template.category}</TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      v{template.current_version}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={() => handleToggleActive(template.id, template.is_active)}
                        />
                        <span className="text-xs text-muted-foreground min-w-[32px]">
                          {template.is_active ? '활성' : '비활성'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">
                      {new Date(template.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPreviewTemplateId(template.id)
                            setPreviewStep(0)
                            setPreviewValues({})
                            setIsPreviewOpen(true)
                          }}
                          className="gap-1 h-8 text-xs px-2.5 shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" /> 미리보기
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(template)}
                          className="gap-1 h-8 text-xs px-2.5 shrink-0"
                        >
                          <Edit className="w-3.5 h-3.5" /> 수정
                        </Button>
                        <Button variant="default" size="sm" asChild className="h-8 text-xs px-2.5 shrink-0">
                          <Link href={`/admin/forms/builder/${template.id}`} className="gap-1 flex items-center">
                            <Edit2 className="w-3.5 h-3.5" /> 폼 빌더
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Template Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>폼 템플릿 수정</DialogTitle>
            <DialogDescription>
              템플릿의 명칭 및 제품군 정보를 변경합니다.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTemplate}>
            <FieldGroup className="space-y-4">
              <Field>
                <FieldLabel htmlFor="editName">템플릿명 *</FieldLabel>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="예: 리본 장식 클래식 화이트형"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="editCategory">지류 청첩장 제품군 카테고리 *</FieldLabel>
                <Input
                  id="editCategory"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="예: 클래식 화이트 라인"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="editDescription">템플릿 설명</FieldLabel>
                <Input
                  id="editDescription"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="설명을 입력하세요."
                />
              </Field>
              <Field className="flex items-center justify-between bg-muted/20 p-2.5 rounded-lg border border-border mt-2">
                <div>
                  <FieldLabel htmlFor="editIncludesMobile" className="text-xs font-semibold">모바일 청첩장 제작 포함</FieldLabel>
                  <p className="text-[10px] text-muted-foreground mt-0.5">이 설문 양식이 모바일 청첩장 데이터 수집도 포함하는지 여부</p>
                </div>
                <Switch
                  id="editIncludesMobile"
                  checked={editIncludesMobile}
                  onCheckedChange={setEditIncludesMobile}
                  className="scale-90 shrink-0"
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6 pt-6 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                수정 완료
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="w-5 h-5 text-primary" /> 폼 미리보기 (Preview)
            </DialogTitle>
            <DialogDescription className="text-xs">
              실제 고객이 접속하여 작성할 때와 동일하게 유효성 검사 및 페이지 이동이 가능하지만, 제출 단계에서 DB에 등록되지 않습니다.
            </DialogDescription>
          </DialogHeader>

          {isLoadingPreviewFields ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mt-2">필드 설정을 가져오는 중...</p>
            </div>
          ) : stepKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              설정된 질문 필드가 없습니다. 폼 빌더에서 필드를 먼저 배치해 주세요.
            </div>
          ) : (
            <div className="py-4 space-y-6">
              {/* Progress Indicator */}
              <div className="space-y-1 bg-muted/40 p-3 rounded-lg border border-border">
                <div className="flex justify-between items-center text-xs font-medium text-slate-600">
                  <span>단계 {previewStep + 1} / {stepKeys.length} ({currentStepKey})</span>
                  <span>{Math.round(((previewStep + 1) / stepKeys.length) * 100)}% 완료</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                  <div 
                    className="bg-primary h-full transition-all duration-300" 
                    style={{ width: `${Math.round(((previewStep + 1) / stepKeys.length) * 100)}%` }} 
                  />
                </div>
              </div>

              {/* Form Body for Current Step */}
              <div className="space-y-5 px-1">
                {(() => {
                  let lastSectionTitle = ''
                  const rootFields = currentFields.filter((f) => !parseOptions(f).parent_field_key)

                  return rootFields.map((field) => {
                    const opts = parseOptions(field)
                    const currentSection = opts.section_title || ''
                    const showSectionHeader = currentSection && currentSection !== lastSectionTitle
                    if (showSectionHeader) {
                      lastSectionTitle = currentSection
                    }

                    const children = currentFields.filter(
                      (c) => parseOptions(c).parent_field_key === field.field_key
                    )

                    return (
                      <React.Fragment key={field.field_key}>
                        {showSectionHeader && (
                          <div className="pt-4 pb-1 border-b border-slate-200 mt-6 first:mt-0">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-1.5 h-3.5 bg-primary rounded-full" />
                              {currentSection}
                            </h4>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Field>
                            <FieldLabel htmlFor={`preview-${field.field_key}`} className="text-xs font-semibold">
                              {field.label}
                              {field.is_required && <span className="text-red-500 ml-1">*</span>}
                            </FieldLabel>
                            {opts.attached_images?.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 my-1.5">
                                {opts.attached_images.map((img: string, idx: number) => (
                                  <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-border shadow-sm">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={img} alt="Reference Attachment" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            )}
                            {renderPreviewInputField(field)}
                          </Field>

                          {/* Children rendering */}
                          {children.map((childField) => {
                            const childOpts = parseOptions(childField)
                            let parentVal = (previewValues[field.field_key] || '').toString().trim()
                            if (parentVal === 'true') parentVal = '예'
                            if (parentVal === 'false') parentVal = '아니오'
                            const triggerVal = (childOpts.parent_trigger_option || '').toString().trim()
                            const isTriggered = parentVal === triggerVal && parentVal !== ''

                            return (
                              <div
                                key={childField.field_key}
                                className={`transition-all duration-300 ease-in-out overflow-hidden border-l-2 border-primary/30 pl-4 ml-1 mt-1 ${
                                  isTriggered 
                                    ? 'max-h-[500px] opacity-100 py-2' 
                                    : 'max-h-0 opacity-0 py-0 pointer-events-none'
                                }`}
                              >
                                <Field>
                                  <FieldLabel htmlFor={`preview-${childField.field_key}`} className="text-xs font-semibold text-slate-600">
                                    {childField.label}
                                    {childField.is_required && <span className="text-red-500 ml-1">*</span>}
                                  </FieldLabel>
                                  {childOpts.attached_images?.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 my-1.5">
                                      {childOpts.attached_images.map((img: string, idx: number) => (
                                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-border shadow-sm">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={img} alt="Reference Attachment" className="w-full h-full object-cover" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {renderPreviewInputField(childField)}
                                </Field>
                              </div>
                            )
                          })}
                        </div>
                      </React.Fragment>
                    )
                  })
                })()}
              </div>

              {/* Navigation Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewStep(s => Math.max(0, s - 1))}
                  disabled={previewStep === 0}
                >
                  이전 단계
                </Button>
                {previewStep === stepKeys.length - 1 ? (
                  <Button size="sm" onClick={handlePreviewSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    미리보기 완료 테스트
                  </Button>
                ) : (
                  <Button size="sm" onClick={handlePreviewNext}>
                    다음 단계
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
