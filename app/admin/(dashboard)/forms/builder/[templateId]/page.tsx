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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  useFieldsQuery, 
  useFormTemplateQuery, 
  useFormTemplateFieldsQuery, 
  useSaveTemplateFieldsMutation 
} from '@/hooks/queries/useForms'
import { supabase } from '@/lib/supabase'
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
  AlertCircle,
  Search
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const getDefaultFieldBlocks = () => [
  {
    id: 'block_groom_info',
    name: '기본 신랑 정보 블록',
    description: '신랑의 이름, 연락처, 혼주 정보 및 계좌 정보 세트',
    fields: [
      { field_key: 'groom_name', label_override: '신랑 한글 성함', is_required: true, section_title: '신랑 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'groom_name_en', label_override: '신랑 영문 성함', is_required: false, section_title: '신랑 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'groom_phone', label_override: '신랑 연락처', is_required: true, section_title: '신랑 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'groom_father_name', label_override: '신랑 아버님 성함', is_required: false, section_title: '신랑 혼주 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'groom_mother_name', label_override: '신랑 어머님 성함', is_required: false, section_title: '신랑 혼주 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'groom_bank_name', label_override: '신랑 축의금 은행', is_required: false, section_title: '신랑 계좌 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'groom_account_number', label_override: '신랑 계좌 번호', is_required: false, section_title: '신랑 계좌 정보', page_title: '1단계: 신랑신부' }
    ]
  },
  {
    id: 'block_bride_info',
    name: '기본 신부 정보 블록',
    description: '신부의 이름, 연락처, 혼주 정보 및 계좌 정보 세트',
    fields: [
      { field_key: 'bride_name', label_override: '신부 한글 성함', is_required: true, section_title: '신부 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'bride_name_en', label_override: '신부 영문 성함', is_required: false, section_title: '신부 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'bride_phone', label_override: '신부 연락처', is_required: true, section_title: '신부 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'bride_father_name', label_override: '신부 아버님 성함', is_required: false, section_title: '신부 혼주 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'bride_mother_name', label_override: '신부 어머님 성함', is_required: false, section_title: '신부 혼주 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'bride_bank_name', label_override: '신부 축의금 은행', is_required: false, section_title: '신부 계좌 정보', page_title: '1단계: 신랑신부' },
      { field_key: 'bride_account_number', label_override: '신부 계좌 번호', is_required: false, section_title: '신부 계좌 정보', page_title: '1단계: 신랑신부' }
    ]
  },
  {
    id: 'block_wedding_info',
    name: '기본 예식장 및 일정 블록',
    description: '예식 일자, 예식 시간, 예식장 이름 및 주소 정보 세트',
    fields: [
      { field_key: 'wedding_date', label_override: '예식 일자', is_required: true, section_title: '예식 정보', page_title: '2단계: 예식 정보' },
      { field_key: 'wedding_time', label_override: '예식 시간', is_required: true, section_title: '예식 정보', page_title: '2단계: 예식 정보' },
      { field_key: 'wedding_hall_name', label_override: '예식장명 (홀이름 포함)', is_required: true, section_title: '예식 장소', page_title: '2단계: 예식 정보' },
      { field_key: 'wedding_hall_address', label_override: '예식장 주소', is_required: true, section_title: '예식 장소', page_title: '2단계: 예식 정보' },
      { field_key: 'wedding_hall_phone', label_override: '예식장 연락처', is_required: false, section_title: '예식 장소', page_title: '2단계: 예식 정보' }
    ]
  }
]

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
  const [searchQuery, setSearchQuery] = useState('')

  // Predefined blocks states
  const [activeTab, setActiveTab] = useState<'fields' | 'blocks'>('fields')
  const [fieldBlocks, setFieldBlocks] = useState<any[]>([])
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false)

  // Virtual Layout hierarchy empty states (stores empty pages and sections)
  const [emptyPages, setEmptyPages] = useState<string[]>([])
  const [emptySections, setEmptySections] = useState<Record<string, string[]>>({})
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)

  // Native drag & drop state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverSection, setDragOverSection] = useState<{ page: string; section: string } | null>(null)
  const [dragOverFieldOriginalIndex, setDragOverFieldOriginalIndex] = useState<number | null>(null)

  // Populate state on load
  useEffect(() => {
    if (templateFields && templateFields.length > 0) {
      const fields = templateFields.map((tf: any) => {
        const defaultChoices = (tf.field_library?.field_type === 'select' || tf.field_library?.field_type === 'rselect')
          ? (tf.field_library?.validation_rules?.choices || [])
          : null
        
        let mergedOptions = tf.options || null
        if (tf.field_library?.field_type === 'select' || tf.field_library?.field_type === 'rselect') {
          if (!mergedOptions) {
            mergedOptions = { choices: defaultChoices || [] }
          } else if (!mergedOptions.choices) {
            mergedOptions = { ...mergedOptions, choices: defaultChoices || [] }
          }
        }

        return {
          field_library_id: tf.field_library_id,
          label: tf.field_library?.label || '',
          field_key: tf.field_library?.field_key || '',
          field_type: tf.field_library?.field_type || '',
          category: tf.field_library?.category || '',
          label_override: tf.label_override || '',
          help_text_override: tf.help_text_override || '',
          is_required: tf.is_required || false,
          options: mergedOptions,
        }
      })
      setSelectedFields(fields)
      setEmptyPages([])
      setEmptySections({})
    } else {
      setSelectedFields([])
      setEmptyPages([])
      setEmptySections({})
    }
  }, [templateFields])

  // Fetch field blocks on load
  useEffect(() => {
    const fetchBlocks = async () => {
      setIsLoadingBlocks(true)
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('key', 'field_blocks')
          .single()
        if (data && data.value) {
          setFieldBlocks(data.value)
        } else {
          setFieldBlocks(getDefaultFieldBlocks())
        }
      } catch (err) {
        console.error(err)
        setFieldBlocks(getDefaultFieldBlocks())
      } finally {
        setIsLoadingBlocks(false)
      }
    }
    fetchBlocks()
  }, [])

  // Hierarchical helper (computes structure dynamically from selectedFields + empty state)
  const getPagesAndSections = () => {
    const pages: { title: string; sections: { title: string; fields: any[] }[] }[] = []
    
    // 1. Distribute selectedFields into pages/sections
    selectedFields.forEach((field, index) => {
      const pageTitle = field.options?.page_title?.trim() || '기본 페이지'
      const sectionTitle = field.options?.section_title?.trim() || '기본 섹션'
      
      let page = pages.find(p => p.title === pageTitle)
      if (!page) {
        page = { title: pageTitle, sections: [] }
        pages.push(page)
      }
      
      let section = page.sections.find(s => s.title === sectionTitle)
      if (!section) {
        section = { title: sectionTitle, fields: [] }
        page.sections.push(section)
      }
      
      section.fields.push({ ...field, originalIndex: index })
    })
    
    // 2. Add empty pages if they are not already in pages
    emptyPages.forEach(pTitle => {
      if (!pages.some(p => p.title === pTitle)) {
        pages.push({ title: pTitle, sections: [] })
      }
    })
    
    // 3. Add empty sections for each page
    pages.forEach(page => {
      const eSections = emptySections[page.title] || []
      eSections.forEach(sTitle => {
        if (!page.sections.some(s => s.title === sTitle)) {
          page.sections.push({ title: sTitle, fields: [] })
        }
      })
      
      // Fallback: make sure page has at least one section
      if (page.sections.length === 0) {
        page.sections.push({ title: '기본 섹션', fields: [] })
      }
    })
    
    return pages
  }

  const handleAddBlock = (block: any) => {
    let addedCount = 0
    let skippedCount = 0
    const newFields = [...selectedFields]

    block.fields.forEach((bf: any) => {
      const libField = allFields?.find((f: any) => f.field_key === bf.field_key)
      if (!libField) {
        skippedCount++
        return
      }

      if (newFields.some((f) => f.field_library_id === libField.id)) {
        skippedCount++
        return
      }

      const defaultChoices = (libField.field_type === 'select' || libField.field_type === 'rselect')
        ? (libField.validation_rules?.choices || [])
        : null

      const pageTitle = bf.page_title || '기본 페이지'
      const sectionTitle = bf.section_title || '기본 섹션'

      const opts = {
        section_title: sectionTitle,
        page_title: pageTitle,
        parent_field_key: bf.parent_field_key || null,
        parent_trigger_option: bf.parent_trigger_option || null,
        choices: defaultChoices || []
      }

      newFields.push({
        field_library_id: libField.id,
        label: libField.label,
        field_key: libField.field_key,
        field_type: libField.field_type,
        category: libField.category,
        label_override: bf.label_override || '',
        help_text_override: bf.help_text_override || '',
        is_required: bf.is_required || false,
        options: opts,
      })
      addedCount++
    })

    if (addedCount > 0) {
      setSelectedFields(newFields)
      toast.success(`"${block.name}" 블록에서 ${addedCount}개 필드가 배치되었습니다.`)
    } else {
      toast.warning('블록 내 모든 필드가 이미 배치되어 있습니다.')
    }
  }

  const handleAddField = (field: any) => {
    if (selectedFields.some((f) => f.field_library_id === field.id)) {
      toast.warning('이미 추가된 필드입니다.')
      return
    }

    const defaultChoices = (field.field_type === 'select' || field.field_type === 'rselect')
      ? (field.validation_rules?.choices || [])
      : null

    const pages = getPagesAndSections()
    const lastPage = pages[pages.length - 1]?.title || '기본 페이지'
    const lastSection = pages[pages.length - 1]?.sections[pages[pages.length - 1]?.sections.length - 1]?.title || '기본 섹션'

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
        options: {
          choices: defaultChoices || [],
          page_title: lastPage,
          section_title: lastSection
        },
      },
    ])
    toast.success(`"${field.label}" 필드가 ${lastPage} > ${lastSection}에 추가되었습니다.`)
  }

  const handleAddFieldToSection = (pageTitle: string, sectionTitle: string, fieldKey: string) => {
    const field = allFields?.find(f => f.field_key === fieldKey)
    if (!field) return

    if (selectedFields.some((f) => f.field_library_id === field.id)) {
      toast.warning('이미 추가된 필드입니다.')
      return
    }

    const defaultChoices = (field.field_type === 'select' || field.field_type === 'rselect')
      ? (field.validation_rules?.choices || [])
      : null

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
        options: {
          choices: defaultChoices || [],
          page_title: pageTitle,
          section_title: sectionTitle
        },
      },
    ])
    toast.success(`"${field.label}" 필드가 ${pageTitle} > ${sectionTitle}에 추가되었습니다.`)
  }

  const handleRemoveField = (id: string) => {
    setSelectedFields((prev) => prev.filter((f) => f.field_library_id !== id))
  }

  const handleUpdateFieldProperty = (id: string, key: string, value: any) => {
    setSelectedFields((prev) =>
      prev.map((f) => (f.field_library_id === id ? { ...f, [key]: value } : f))
    )
  }

  const handleRenamePage = (oldTitle: string, newTitle: string) => {
    if (!newTitle.trim() || oldTitle === newTitle) return
    
    setEmptyPages(prev => prev.map(p => p === oldTitle ? newTitle : p))
    setEmptySections(prev => {
      const updated = { ...prev }
      if (updated[oldTitle]) {
        updated[newTitle] = updated[oldTitle]
        delete updated[oldTitle]
      }
      return updated
    })
    
    setSelectedFields(prev =>
      prev.map(f => {
        const pTitle = f.options?.page_title?.trim() || '기본 페이지'
        if (pTitle === oldTitle) {
          return {
            ...f,
            options: {
              ...(f.options || {}),
              page_title: newTitle.trim()
            }
          }
        }
        return f
      })
    )
  }

  const handleRenameSection = (pageTitle: string, oldTitle: string, newTitle: string) => {
    if (!newTitle.trim() || oldTitle === newTitle) return
    
    setEmptySections(prev => ({
      ...prev,
      [pageTitle]: (prev[pageTitle] || []).map(s => s === oldTitle ? newTitle : s)
    }))
    
    setSelectedFields(prev =>
      prev.map(f => {
        const pTitle = f.options?.page_title?.trim() || '기본 페이지'
        const sTitle = f.options?.section_title?.trim() || '기본 섹션'
        if (pTitle === pageTitle && sTitle === oldTitle) {
          return {
            ...f,
            options: {
              ...(f.options || {}),
              section_title: newTitle.trim()
            }
          }
        }
        return f
      })
    )
  }

  const handleDeletePage = (pageTitle: string) => {
    if (!confirm(`"${pageTitle}" 단계에 포함된 모든 필드가 해제됩니다. 정말로 삭제하시겠습니까?`)) {
      return
    }
    
    setEmptyPages(prev => prev.filter(p => p !== pageTitle))
    setEmptySections(prev => {
      const updated = { ...prev }
      delete updated[pageTitle]
      return updated
    })
    
    setSelectedFields(prev => prev.filter(f => (f.options?.page_title?.trim() || '기본 페이지') !== pageTitle))
  }

  const handleDeleteSection = (pageTitle: string, sectionTitle: string) => {
    if (!confirm(`"${sectionTitle}" 섹션에 포함된 모든 필드가 해제됩니다. 정말로 삭제하시겠습니까?`)) {
      return
    }
    
    setEmptySections(prev => ({
      ...prev,
      [pageTitle]: (prev[pageTitle] || []).filter(s => s !== sectionTitle)
    }))
    
    setSelectedFields(prev => prev.filter(f => 
      !((f.options?.page_title?.trim() || '기본 페이지') === pageTitle &&
        (f.options?.section_title?.trim() || '기본 섹션') === sectionTitle)
    ))
  }

  const handleAddPage = () => {
    const pages = getPagesAndSections()
    const newPageTitle = prompt('새로운 단계(페이지) 이름을 입력하세요:', `단계 ${pages.length + 1}`)
    if (!newPageTitle || !newPageTitle.trim()) return
    const trimmed = newPageTitle.trim()
    if (pages.some(p => p.title === trimmed)) {
      toast.error('이미 존재하는 단계 이름입니다.')
      return
    }
    setEmptyPages(prev => [...prev, trimmed])
    setEmptySections(prev => ({
      ...prev,
      [trimmed]: ['기본 섹션']
    }))
    toast.success(`"${trimmed}" 단계가 생성되었습니다.`)
  }

  const handleAddSection = (pageTitle: string) => {
    const pages = getPagesAndSections()
    const page = pages.find(p => p.title === pageTitle)
    const newSectionTitle = prompt(`"${pageTitle}" 단계에 추가할 새 섹션 이름을 입력하세요:`, '새 섹션')
    if (!newSectionTitle || !newSectionTitle.trim()) return
    const trimmed = newSectionTitle.trim()
    if (page && page.sections.some(s => s.title === trimmed)) {
      toast.error('이미 존재하는 섹션 이름입니다.')
      return
    }
    setEmptySections(prev => ({
      ...prev,
      [pageTitle]: [...(prev[pageTitle] || []), trimmed]
    }))
    toast.success(`"${trimmed}" 섹션이 추가되었습니다.`)
  }

  const handleMoveFieldTo = (fromIndex: number, toPage: string, toSection: string, targetFieldIndexInSection?: number) => {
    const updated = [...selectedFields]
    const [movedField] = updated.splice(fromIndex, 1)
    
    movedField.options = {
      ...(movedField.options || {}),
      page_title: toPage,
      section_title: toSection
    }
    
    let insertIndex = -1
    const sectionFields = updated.filter(f => 
      (f.options?.page_title?.trim() || '기본 페이지') === toPage &&
      (f.options?.section_title?.trim() || '기본 섹션') === toSection
    )
    
    if (sectionFields.length === 0) {
      const pageFields = updated.filter(f => (f.options?.page_title?.trim() || '기본 페이지') === toPage)
      if (pageFields.length > 0) {
        const lastPageField = pageFields[pageFields.length - 1]
        insertIndex = updated.indexOf(lastPageField) + 1
      } else {
        insertIndex = updated.length
      }
    } else {
      if (targetFieldIndexInSection !== undefined && targetFieldIndexInSection < sectionFields.length) {
        const targetField = sectionFields[targetFieldIndexInSection]
        insertIndex = updated.indexOf(targetField)
      } else {
        const lastSectionField = sectionFields[sectionFields.length - 1]
        insertIndex = updated.indexOf(lastSectionField) + 1
      }
    }
    
    updated.splice(insertIndex, 0, movedField)
    setSelectedFields(updated)
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

  // Group available fields by category and filter by search query
  const filteredFields = allFields?.filter((f) => {
    if (!searchQuery) return true
    const term = searchQuery.toLowerCase()
    return (
      f.label.toLowerCase().includes(term) ||
      f.field_key.toLowerCase().includes(term) ||
      f.category.toLowerCase().includes(term)
    )
  }) || []

  const groupedFields: Record<string, any[]> = {}
  filteredFields.forEach((f) => {
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
            <CardHeader className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-border shadow-sm p-4 pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> 필드 라이브러리 목록
              </CardTitle>
              <CardDescription className="text-xs">
                원하는 필드 또는 블록을 추가하여 정보 수집 양식을 손쉽게 구성하세요.
              </CardDescription>

              {/* Tab Switch */}
              <div className="flex border-b border-border mt-3 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('fields')}
                  className={`pb-2 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === 'fields'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  개별 필드 추가
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('blocks')}
                  className={`pb-2 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === 'blocks'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  필드 블록 추가
                </button>
              </div>

              {activeTab === 'fields' && (
                <div className="mt-3 relative">
                  <Input
                    placeholder="필드명 또는 키워드 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-8 bg-muted/30 focus:bg-card border border-border/80"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => setSearchQuery('')}
                    >
                      ×
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>

            {activeTab === 'fields' ? (
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
            ) : (
              <CardContent className="p-4 space-y-4">
                {isLoadingBlocks ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">블록을 불러오는 중...</p>
                  </div>
                ) : (
                  fieldBlocks.map((block) => (
                    <div 
                      key={block.id}
                      className="flex flex-col p-3.5 rounded-lg border border-border bg-card hover:bg-muted/5 transition-all text-sm gap-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-semibold text-foreground text-xs">{block.name}</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{block.description}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1 px-2.5 h-7 text-xs bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary font-semibold shrink-0"
                          onClick={() => handleAddBlock(block)}
                        >
                          <Plus className="w-3 h-3" /> 전체 배치
                        </Button>
                      </div>
                      
                      {/* List of fields included in the block */}
                      <div className="flex flex-wrap gap-1 mt-1 bg-muted/20 p-2 rounded border border-border/50">
                        {block.fields.map((f: any, idx: number) => {
                          const isAdded = selectedFields.some((sf) => sf.field_key === f.field_key)
                          return (
                            <Badge 
                              key={idx} 
                              variant={isAdded ? 'secondary' : 'outline'} 
                              className={`text-[9px] px-1.5 py-0.5 scale-90 origin-left shrink-0 ${
                                isAdded ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50' : ''
                              }`}
                            >
                              {f.label_override || f.field_key}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right Side: Selected Template Layout (7/12 width) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="min-h-[60vh] max-h-[75vh] flex flex-col">
            <CardHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  배치된 정보 수집 필드 ({selectedFields.length}개)
                </CardTitle>
                <CardDescription>
                  단계(페이지)와 섹션을 나누어 필드를 관리하고 드래그 앤 드롭으로 순서를 바꿉니다.
                </CardDescription>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleAddPage} className="h-8 text-xs font-semibold text-primary">
                + 새 단계 추가
              </Button>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-6 scrollbar-hide bg-slate-50/50">
              {selectedFields.length === 0 ? (
                <div className="h-[40vh] flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  <AlertCircle className="w-10 h-10 mb-3 text-muted-foreground/60" />
                  <p className="text-sm font-medium">배치된 필드가 없습니다.</p>
                  <p className="text-xs text-muted-foreground mt-1">왼쪽 필드 목록에서 추가 버튼을 눌러주세요.</p>
                </div>
              ) : (
                getPagesAndSections().map((page, pIdx) => (
                  <div key={page.title} className="bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden">
                    {/* Page Header */}
                    <div className="bg-slate-100/80 px-4 py-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <span className="text-xs font-bold text-slate-500 shrink-0">단계 {pIdx + 1}:</span>
                        <input
                          type="text"
                          value={page.title}
                          onChange={(e) => handleRenamePage(page.title, e.target.value)}
                          className="font-bold text-sm text-foreground bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none px-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddSection(page.title)}
                          className="h-7 text-xs font-semibold text-primary"
                        >
                          + 섹션 추가
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePage(page.title)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Page Content: Sections List */}
                    <div className="p-4 space-y-4">
                      {page.sections.map((section, sIdx) => (
                        <div
                          key={section.title}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverSection({ page: page.title, section: section.title })
                          }}
                          onDragLeave={() => setDragOverSection(null)}
                          onDrop={() => {
                            if (draggingIndex !== null) {
                              handleMoveFieldTo(draggingIndex, page.title, section.title)
                            }
                          }}
                          className={cn(
                            "rounded-lg border border-dashed border-border/60 bg-muted/10 p-3 transition-colors",
                            dragOverSection?.page === page.title && dragOverSection?.section === section.title && "border-primary bg-primary/5 ring-2 ring-primary/20"
                          )}
                        >
                          {/* Section Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1 max-w-sm">
                              <span className="text-[10px] font-bold text-slate-400">📂</span>
                              <input
                                type="text"
                                value={section.title}
                                onChange={(e) => handleRenameSection(page.title, section.title, e.target.value)}
                                className="font-semibold text-xs text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none px-1"
                              />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Field Quick-Add Dropdown */}
                              <Select value="" onValueChange={(val) => handleAddFieldToSection(page.title, section.title, val)}>
                                <SelectTrigger className="h-6 text-[10px] w-32 bg-background border-dashed">
                                  <SelectValue placeholder="+ 필드 직접 추가" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allFields?.map(f => {
                                    const isAdded = selectedFields.some(sf => sf.field_key === f.field_key)
                                    return (
                                      <SelectItem key={f.id} value={f.field_key} disabled={isAdded}>
                                        {f.label} ({f.field_key})
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSection(page.title, section.title)}
                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Section Content: Fields List */}
                          <div className="space-y-2">
                            {section.fields.map((field, fIdx) => {
                              const isExpanded = expandedFieldId === field.field_library_id
                              return (
                                <div
                                  key={field.field_library_id}
                                  draggable
                                  onDragStart={() => setDraggingIndex(field.originalIndex)}
                                  onDragEnd={() => {
                                    setDraggingIndex(null)
                                    setDragOverSection(null)
                                    setDragOverFieldOriginalIndex(null)
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setDragOverFieldOriginalIndex(field.originalIndex)
                                  }}
                                  onDrop={(e) => {
                                    e.stopPropagation()
                                    if (draggingIndex !== null && draggingIndex !== field.originalIndex) {
                                      const updated = [...selectedFields]
                                      const [movedField] = updated.splice(draggingIndex, 1)
                                      
                                      movedField.options = {
                                        ...(movedField.options || {}),
                                        page_title: page.title,
                                        section_title: section.title
                                      }
                                      
                                      let targetIdx = field.originalIndex
                                      if (draggingIndex < field.originalIndex) {
                                        targetIdx = field.originalIndex - 1
                                      }
                                      
                                      updated.splice(targetIdx, 0, movedField)
                                      setSelectedFields(updated)
                                    }
                                    setDraggingIndex(null)
                                    setDragOverSection(null)
                                    setDragOverFieldOriginalIndex(null)
                                  }}
                                  className={cn(
                                    "flex flex-col border border-border rounded-lg bg-card shadow-xs transition-all duration-200 overflow-hidden",
                                    draggingIndex === field.originalIndex && "opacity-40 border-dashed border-primary",
                                    dragOverFieldOriginalIndex === field.originalIndex && "border-primary bg-primary/5 ring-1 ring-primary/30"
                                  )}
                                >
                                  {/* Field Summary Row */}
                                  <div className="flex items-center justify-between p-2 hover:bg-muted/5 transition-colors">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <div className="cursor-grab text-slate-400 active:cursor-grabbing shrink-0 text-sm font-mono select-none px-1">
                                        ⠿
                                      </div>
                                      <div className="min-w-0 flex items-center gap-2">
                                        <span className="font-semibold text-xs text-foreground truncate">
                                          {field.label_override || field.label}
                                        </span>
                                        {field.is_required && (
                                          <Badge className="bg-red-50 text-red-600 border-red-200 hover:bg-red-50 text-[9px] px-1 py-0 h-3.5">
                                            필수
                                          </Badge>
                                        )}
                                        <span className="text-[10px] text-muted-foreground font-mono truncate hidden sm:inline">
                                          {field.field_key} • {field.field_type}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Quick toggle settings button */}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={cn("h-7 w-7", isExpanded && "bg-primary/10 text-primary")}
                                        onClick={() => setExpandedFieldId(isExpanded ? null : field.field_library_id)}
                                      >
                                        <Settings className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                        onClick={() => handleRemoveField(field.field_library_id)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Collapsible Details Panel */}
                                  {isExpanded && (
                                    <div className="p-3 bg-muted/5 border-t border-border/60 space-y-3 text-xs">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Label Override */}
                                        <div className="flex flex-col gap-1">
                                          <span className="text-[10px] font-medium text-muted-foreground">라벨명 덮어쓰기 (기본: {field.label})</span>
                                          <Input
                                            placeholder={field.label}
                                            value={field.label_override || ''}
                                            onChange={(e) => handleUpdateFieldProperty(field.field_library_id, 'label_override', e.target.value)}
                                            className="h-7 text-xs bg-background px-2 border border-border"
                                            maxLength={100}
                                          />
                                        </div>

                                        {/* Help Text Override */}
                                        <div className="flex flex-col gap-1">
                                          <span className="text-[10px] font-medium text-muted-foreground">도움말 덮어쓰기</span>
                                          <Input
                                            placeholder="도움말이 표시되지 않음"
                                            value={field.help_text_override || ''}
                                            onChange={(e) => handleUpdateFieldProperty(field.field_library_id, 'help_text_override', e.target.value)}
                                            className="h-7 text-xs bg-background px-2 border border-border"
                                            maxLength={300}
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-3 pt-1">
                                        {/* Required Switch */}
                                        <div className="flex items-center gap-1.5 shrink-0 bg-background px-2 py-0.5 rounded border border-border h-7">
                                          <Switch
                                            id={`req-${field.field_library_id}`}
                                            checked={field.is_required}
                                            onCheckedChange={(checked) => handleUpdateFieldProperty(field.field_library_id, 'is_required', checked)}
                                            className="scale-75"
                                          />
                                          <Label htmlFor={`req-${field.field_library_id}`} className="text-[10px] font-medium text-muted-foreground cursor-pointer select-none">
                                            필수 입력 설정
                                          </Label>
                                        </div>

                                        {/* Options config for Select/Rselect fields */}
                                        {(field.field_type === 'select' || field.field_type === 'rselect') && (
                                          <div className="flex items-center gap-1.5 min-w-[200px] flex-1">
                                            <span className="text-[10px] font-medium text-primary shrink-0 font-semibold">선택지 설정:</span>
                                            <Input
                                              placeholder="쉼표(,)로 구분 예시: 옵션1, 옵션2, 옵션3"
                                              value={Array.isArray(field.options?.choices) ? field.options.choices.join(', ') : ''}
                                              onChange={(e) => {
                                                const currentOpts = typeof field.options === 'string' ? JSON.parse(field.options || '{}') : (field.options || {})
                                                const choices = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                                                const updatedOptions = { ...currentOpts, choices }
                                                handleUpdateFieldProperty(field.field_library_id, 'options', updatedOptions)
                                              }}
                                              className="h-7 text-xs bg-background px-2 border border-border flex-1"
                                              maxLength={1000}
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {/* Sub-question Linkage Settings */}
                                      <div className="pt-2.5 border-t border-border/40 flex flex-col gap-1.5">
                                        <span className="text-[10px] font-semibold text-primary">하위 질문 연동 설정</span>
                                        <div className="flex flex-wrap items-center gap-3">
                                          <div className="flex items-center gap-1.5 min-w-[150px] flex-1">
                                            <span className="text-[10px] font-medium text-muted-foreground shrink-0">상위 질문:</span>
                                            <Select
                                              value={field.options?.parent_field_key || 'none'}
                                              onValueChange={(val) => {
                                                const currentOpts = typeof field.options === 'string' ? JSON.parse(field.options || '{}') : (field.options || {})
                                                const updatedOptions = { 
                                                  ...currentOpts, 
                                                  parent_field_key: val === 'none' ? null : val,
                                                  parent_trigger_option: val === 'none' ? null : (currentOpts.parent_trigger_option || '')
                                                }
                                                handleUpdateFieldProperty(field.field_library_id, 'options', updatedOptions)
                                              }}
                                            >
                                              <SelectTrigger className="h-6 text-[10px] bg-background px-2">
                                                <SelectValue placeholder="선택 안 함" />
                                              </SelectTrigger>
                                              <SelectContent className="text-xs">
                                                <SelectItem value="none">선택 안 함 (최상위 질문)</SelectItem>
                                                {selectedFields
                                                  .filter(f => f.field_library_id !== field.field_library_id && (f.field_type === 'select' || f.field_type === 'rselect' || f.field_type === 'toggle'))
                                                  .map(f => (
                                                    <SelectItem key={f.field_key} value={f.field_key}>
                                                      {f.label_override || f.label} ({f.field_key})
                                                    </SelectItem>
                                                  ))
                                                }
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          {(() => {
                                            const parentField = selectedFields.find((pf) => pf.field_key === field.options?.parent_field_key)
                                            if (!parentField) return null
                                            const parentChoices = parentField.field_type === 'toggle'
                                              ? ['예', '아니오']
                                              : (parentField.options?.choices || [])

                                            return (
                                              <div className="flex items-center gap-1.5 min-w-[150px] flex-1">
                                                <span className="text-[10px] font-medium text-muted-foreground shrink-0">활성화 조건 선택지값:</span>
                                                {parentChoices.length > 0 ? (
                                                  <Select
                                                    value={field.options?.parent_trigger_option || ''}
                                                    onValueChange={(val) => {
                                                      const currentOpts = typeof field.options === 'string' ? JSON.parse(field.options || '{}') : (field.options || {})
                                                      const updatedOptions = { ...currentOpts, parent_trigger_option: val }
                                                      handleUpdateFieldProperty(field.field_library_id, 'options', updatedOptions)
                                                    }}
                                                  >
                                                    <SelectTrigger className="h-6 text-[10px] bg-background px-2">
                                                      <SelectValue placeholder="선택지에서 선택" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {parentChoices.map((choice: string) => (
                                                        <SelectItem key={choice} value={choice}>
                                                          {choice}
                                                        </SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                ) : (
                                                  <Input
                                                    placeholder="상위 질문 선택지가 없습니다 (직접 기입)"
                                                    value={field.options?.parent_trigger_option || ''}
                                                    onChange={(e) => {
                                                      const currentOpts = typeof field.options === 'string' ? JSON.parse(field.options || '{}') : (field.options || {})
                                                      const updatedOptions = { ...currentOpts, parent_trigger_option: e.target.value }
                                                      handleUpdateFieldProperty(field.field_library_id, 'options', updatedOptions)
                                                    }}
                                                    className="h-6 text-[10px] bg-background px-2 border border-border"
                                                  />
                                                )}
                                              </div>
                                            )
                                          })()}
                                        </div>
                                      </div>

                                      {/* Reference Images */}
                                      <div className="pt-2 border-t border-border/40 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-medium text-slate-500">안내용 첨부 이미지 (고객 노출용, 여러 장 가능)</span>
                                          <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-semibold px-2 py-0.5 rounded transition-colors shrink-0">
                                            이미지 추가
                                            <input
                                              type="file"
                                              accept="image/*"
                                              multiple
                                              className="hidden"
                                              onChange={(e) => {
                                                const files = e.target.files
                                                if (!files) return
                                                const currentOpts = typeof field.options === 'string' ? JSON.parse(field.options || '{}') : (field.options || {})
                                                const existing = currentOpts.attached_images || []
                                                const newImgs = [...existing]
                                                let loaded = 0
                                                Array.from(files).forEach((file) => {
                                                  const reader = new FileReader()
                                                  reader.onloadend = () => {
                                                    newImgs.push(reader.result as string)
                                                    loaded++
                                                    if (loaded === files.length) {
                                                      handleUpdateFieldProperty(field.field_library_id, 'options', { ...currentOpts, attached_images: newImgs })
                                                    }
                                                  }
                                                  reader.readAsDataURL(file)
                                                })
                                              }}
                                            />
                                          </label>
                                        </div>

                                        {field.options?.attached_images?.length > 0 && (
                                          <div className="grid grid-cols-6 gap-2 bg-background p-2 rounded border border-border">
                                            {field.options.attached_images.map((img: string, idx: number) => (
                                              <div key={idx} className="relative aspect-video rounded overflow-hidden border border-border group/img">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={img} alt="Attached preview" className="w-full h-full object-cover" />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const currentOpts = typeof field.options === 'string' ? JSON.parse(field.options || '{}') : (field.options || {})
                                                    const updated = (currentOpts.attached_images || []).filter((_: any, i: number) => i !== idx)
                                                    handleUpdateFieldProperty(field.field_library_id, 'options', { ...currentOpts, attached_images: updated })
                                                  }}
                                                  className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] opacity-80 hover:opacity-100"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                            {section.fields.length === 0 && (
                              <div className="text-center py-4 text-xs text-muted-foreground italic select-none">
                                이 섹션은 비어 있습니다. 필드를 추가하거나 다른 필드를 이쪽으로 드래그 앤 드롭해 주세요.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
