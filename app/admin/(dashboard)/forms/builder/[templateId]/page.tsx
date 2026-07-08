'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  useFieldsQuery, 
  useFormTemplateQuery, 
  useFormTemplateFieldsQuery, 
  useSaveTemplateFieldsMutation 
} from '@/hooks/queries/useForms'
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Settings, 
  Check, 
  Loader2, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react'
import { toast } from 'sonner'

export default function FormBuilderPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = use(params)
  const router = useRouter()

  const { data: template, isLoading: isLoadingTemplate } = useFormTemplateQuery(templateId)
  const { data: allFields, isLoading: isLoadingFields } = useFieldsQuery()
  const { data: templateFields, isLoading: isLoadingTemplateFields } = useFormTemplateFieldsQuery(templateId)
  const saveMutation = useSaveTemplateFieldsMutation()

  // State to hold the current builder list
  const [selectedFields, setSelectedFields] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Populate state on load
  useEffect(() => {
    if (templateFields && templateFields.length > 0) {
      setSelectedFields(
        templateFields.map((tf: any) => ({
          field_library_id: tf.field_library_id,
          label: tf.field_library?.label || '',
          field_key: tf.field_library?.field_key || '',
          field_type: tf.field_library?.field_type || '',
          category: tf.field_library?.category || '',
          label_override: tf.label_override || '',
          help_text_override: tf.help_text_override || '',
          is_required: tf.is_required || false,
          options: tf.options || null,
        }))
      )
    } else {
      setSelectedFields([])
    }
  }, [templateFields])

  const handleAddField = (field: any) => {
    // Prevent duplicates
    if (selectedFields.some((f) => f.field_library_id === field.id)) {
      toast.warning('이미 추가된 필드입니다.')
      return
    }

    setSelectedFields((prev) => [
      ...prev,
      {
        field_library_id: field.id,
        label: field.label,
        field_key: field.field_key,
        field_type: field.field_type,
        category: field.category,
        label_override: '',
        help_text_override: '',
        is_required: false,
        options: null,
      },
    ])
    toast.success(`"${field.label}" 필드가 배치되었습니다.`)
  }

  const handleRemoveField = (id: string) => {
    setSelectedFields((prev) => prev.filter((f) => f.field_library_id !== id))
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === selectedFields.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...selectedFields]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setSelectedFields(updated)
  }

  const handleUpdateFieldProperty = (id: string, key: string, value: any) => {
    setSelectedFields((prev) =>
      prev.map((f) => (f.field_library_id === id ? { ...f, [key]: value } : f))
    )
  }

  const handleSave = async () => {
    if (selectedFields.length === 0) {
      toast.error('최소 1개 이상의 필드를 구성해야 합니다.')
      return
    }

    setIsSaving(true)
    try {
      const formattedFields = selectedFields.map((f, index) => ({
        field_library_id: f.field_library_id,
        label_override: f.label_override.trim() || null,
        help_text_override: f.help_text_override.trim() || null,
        is_required: f.is_required,
        sort_order: index + 1,
        options: f.options,
      }))

      await saveMutation.mutateAsync({
        templateId,
        fields: formattedFields,
      })

      toast.success('폼 레이아웃 구성 및 신규 버전이 저장되었습니다.')
      router.push('/admin/forms')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingTemplate || isLoadingFields || isLoadingTemplateFields) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm mt-4">폼 빌더를 불러오는 중입니다...</p>
      </div>
    )
  }

  // Group available fields by category
  const groupedFields: Record<string, any[]> = {}
  allFields?.forEach((f) => {
    if (!groupedFields[f.category]) {
      groupedFields[f.category] = []
    }
    groupedFields[f.category].push(f)
  })

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/forms">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              폼 빌더: {template?.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              양측 정보 수집을 위한 필드를 드래그앤드롭/추가 및 속성을 제어합니다 (현재 버전: v{template?.current_version})
            </p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="outline" asChild>
            <Link href="/admin/forms">취소</Link>
          </Button>
          <Button onClick={handleSave} className="gap-2" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            설정 저장 (신규 버전 발행)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Fields Library (5/12 width) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="max-h-[75vh] overflow-y-auto scrollbar-hide">
            <CardHeader className="sticky top-0 bg-card z-10 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> 필드 라이브러리 목록
              </CardTitle>
              <CardDescription>
                원하는 필드의 [+] 버튼을 눌러 청첩장 정보 수집 폼에 배치하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              {Object.entries(groupedFields).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase bg-muted/40 px-2 py-1.5 rounded">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                    {items.map((field) => {
                      const isAdded = selectedFields.some((f) => f.field_library_id === field.id)
                      return (
                        <div 
                          key={field.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/5 transition-all text-sm group"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate">{field.label}</span>
                              <Badge variant="outline" className="text-[10px] scale-90 px-1 py-0 h-4">
                                {field.field_type}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono truncate block mt-0.5">
                              {field.field_key}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant={isAdded ? 'secondary' : 'outline'}
                            className="h-8 w-8 shrink-0 transition-transform active:scale-95"
                            onClick={() => handleAddField(field)}
                            disabled={isAdded}
                          >
                            {isAdded ? <Check className="w-4 h-4 text-green-600" /> : <Plus className="w-4 h-4" />}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Selected Template Layout (7/12 width) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="min-h-[60vh] max-h-[75vh] flex flex-col">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-base font-semibold">
                배치된 정보 수집 필드 ({selectedFields.length}개)
              </CardTitle>
              <CardDescription>
                배치된 필드의 순서를 정렬하고, 필수 입력 옵션이나 라벨명을 덮어쓸 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 scrollbar-hide">
              {selectedFields.length === 0 ? (
                <div className="h-[40vh] flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  <AlertCircle className="w-10 h-10 mb-3 text-muted-foreground/60" />
                  <p className="text-sm font-medium">배치된 필드가 없습니다.</p>
                  <p className="text-xs text-muted-foreground mt-1">왼쪽 필드 목록에서 추가 버튼을 눌러주세요.</p>
                </div>
              ) : (
                selectedFields.map((field, index) => (
                  <div 
                    key={field.field_library_id}
                    className="flex flex-col border border-border rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                  >
                    {/* Top Row: Basic Info & Actions */}
                    <div className="flex items-center justify-between p-3.5 bg-muted/20 border-b border-border">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMove(index, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMove(index, 'down')}
                            disabled={index === selectedFields.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {index + 1}. {field.label_override || field.label}
                            </span>
                            {field.is_required && (
                              <Badge className="bg-red-50 text-red-600 border-red-200 hover:bg-red-50 text-[10px] px-1.5 py-0 h-4">
                                필수
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono block mt-0.5">
                            {field.field_key} • {field.category}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveField(field.field_library_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Collapsible Property Editing Panel */}
                    <div className="p-4 bg-card grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">라벨명 덮어쓰기 (선택)</Label>
                          <Input
                            placeholder={field.label}
                            value={field.label_override}
                            onChange={(e) => handleUpdateFieldProperty(field.field_library_id, 'label_override', e.target.value)}
                            className="h-8 text-xs bg-muted/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">도움말 덮어쓰기 (선택)</Label>
                          <Input
                            placeholder="입력 예시나 설명을 적어주세요."
                            value={field.help_text_override}
                            onChange={(e) => handleUpdateFieldProperty(field.field_library_id, 'help_text_override', e.target.value)}
                            className="h-8 text-xs bg-muted/10"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col justify-between pt-1">
                        <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/5">
                          <div className="space-y-0.5">
                            <span className="font-medium text-xs text-foreground block">필수 입력 설정</span>
                            <span className="text-[10px] text-muted-foreground block">고객이 이 값을 비워둘 수 없도록 제한합니다.</span>
                          </div>
                          <Switch
                            checked={field.is_required}
                            onCheckedChange={(checked) => handleUpdateFieldProperty(field.field_library_id, 'is_required', checked)}
                          />
                        </div>
                        
                        <div className="text-[10px] text-muted-foreground text-right mt-3">
                          필드 타입: <span className="font-mono font-semibold uppercase">{field.field_type}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
