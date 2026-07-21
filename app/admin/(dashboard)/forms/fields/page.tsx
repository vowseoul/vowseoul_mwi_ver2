'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { useFieldsQuery, useCreateFieldMutation, useUpdateFieldMutation, useDeleteFieldMutation } from '@/hooks/queries/useForms'
import { Plus, Search, ArrowLeft, Shield, FileCode2, Loader2, Save, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Settings, Sparkles, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { Switch } from '@/components/ui/switch'

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

export default function FieldLibraryPage() {
  const { data: fields, isLoading, error } = useFieldsQuery()
  const createMutation = useCreateFieldMutation()
  const updateMutation = useUpdateFieldMutation()
  const deleteMutation = useDeleteFieldMutation()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Block management states
  const [activeTab, setActiveTab] = useState<'fields' | 'blocks'>('fields')
  const [fieldBlocks, setFieldBlocks] = useState<any[]>([])
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false)
  const [isEditingBlockView, setIsEditingBlockView] = useState(false)
  const [editingBlock, setEditingBlock] = useState<any>(null)
  const [blockName, setBlockName] = useState('')
  const [blockDescription, setBlockDescription] = useState('')
  const [blockFields, setBlockFields] = useState<any[]>([])
  const [isSavingBlock, setIsSavingBlock] = useState(false)
  const [expandedLinkKey, setExpandedLinkKey] = useState<string | null>(null)

  // Track initial state for isDirty check
  const [initialBlockFields, setInitialBlockFields] = useState<any[]>([])
  const [initialBlockName, setInitialBlockName] = useState('')
  const [initialBlockDescription, setInitialBlockDescription] = useState('')

  const isDirty = useMemo(() => {
    return (
      blockName !== initialBlockName ||
      blockDescription !== initialBlockDescription ||
      JSON.stringify(blockFields) !== JSON.stringify(initialBlockFields)
    )
  }, [blockName, initialBlockName, blockDescription, initialBlockDescription, blockFields, initialBlockFields])

  const handleCloseBlockEditor = () => {
    if (isDirty) {
      const ok = confirm('작성 중인 변경사항이 있습니다. 저장하지 않고 편집기를 닫으시겠습니까?')
      if (!ok) return
    }
    setIsEditingBlockView(false)
  }

  useEffect(() => {
    if (!isDirty || !isEditingBlockView) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, isEditingBlockView])

  const fetchFieldBlocks = async () => {
    setIsLoadingBlocks(true)
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'field_blocks')
        .single()
      if (error) {
        if (error.code === 'PGRST116') {
          const defaults = getDefaultFieldBlocks()
          await supabase.from('settings').insert({ key: 'field_blocks', value: defaults })
          setFieldBlocks(defaults)
        } else {
          console.error(error)
          setFieldBlocks(getDefaultFieldBlocks())
        }
      } else if (data && data.value) {
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

  useEffect(() => {
    fetchFieldBlocks()
  }, [])

  // Sorting State
  const [sortField, setSortField] = useState<'label' | 'field_key' | 'field_type' | 'category' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: 'label' | 'field_key' | 'field_type' | 'category') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Dynamic available categories from current data
  const availableCategories = React.useMemo(() => {
    if (!fields) return ['신랑 정보', '신부 정보', '예식 정보', '혼주 정보', '계좌 정보', '이미지', 'BGM', 'RSVP 설정', '카카오 공유', '영상', '지류 전용']
    const cats = new Set(fields.map((f) => f.category).filter(Boolean))
    ;['신랑 정보', '신부 정보', '예식 정보', '혼주 정보', '계좌 정보', '이미지', 'BGM', 'RSVP 설정', '카카오 공유', '영상', '지류 전용'].forEach((c) => cats.add(c))
    return Array.from(cats)
  }, [fields])

  // New Field State
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newHelpText, setNewHelpText] = useState('')
  const [newType, setNewType] = useState<any>('text')
  const [newCategory, setNewCategory] = useState<string>('신랑 정보')
  const [newChoices, setNewChoices] = useState('')
  const [newSelectTextChoices, setNewSelectTextChoices] = useState<string[]>([''])
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [newIsSystem, setNewIsSystem] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit Field State
  const [editingField, setEditingField] = useState<any>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editHelpText, setEditHelpText] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editChoices, setEditChoices] = useState('')
  const [editSelectTextChoices, setEditSelectTextChoices] = useState<string[]>([''])
  const [isEditCustomCategory, setIsEditCustomCategory] = useState(false)
  const [editIsSystem, setEditIsSystem] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleOpenEdit = (field: any) => {
    setEditingField(field)
    setEditLabel(field.label)
    setEditHelpText(field.help_text || '')
    setEditCategory(field.category)
    setEditIsSystem(field.is_system)
    const choices = field.validation_rules?.choices || []
    setEditChoices(Array.isArray(choices) ? choices.join('\n') : '')
    setIsEditCustomCategory(false)
    setIsEditOpen(true)
  }

  // Block management helper handlers
  const handleOpenBlockCreate = () => {
    setEditingBlock(null)
    setBlockName('')
    setBlockDescription('')
    setBlockFields([])
    setInitialBlockName('')
    setInitialBlockDescription('')
    setInitialBlockFields([])
    setExpandedLinkKey(null)
    setIsEditingBlockView(true)
  }

  const handleOpenBlockEdit = (block: any) => {
    setEditingBlock(block)
    setBlockName(block.name)
    setBlockDescription(block.description || '')
    const copiedFields = JSON.parse(JSON.stringify(block.fields || []))
    setBlockFields(copiedFields)
    setInitialBlockName(block.name)
    setInitialBlockDescription(block.description || '')
    setInitialBlockFields(JSON.parse(JSON.stringify(block.fields || [])))
    setExpandedLinkKey(null)
    setIsEditingBlockView(true)
  }

  const handleAddFieldToBlock = (fieldKey: string) => {
    if (!fieldKey) return
    const libField = fields?.find(f => f.field_key === fieldKey)
    if (!libField) return
    
    // Prevent duplicate keys inside block
    if (blockFields.some(bf => bf.field_key === fieldKey)) {
      toast.warning('이미 블록에 포함된 필드입니다.')
      return
    }

    setBlockFields(prev => [
      ...prev,
      {
        field_key: fieldKey,
        label_override: '',
        is_required: false,
        section_title: '',
        page_title: ''
      }
    ])
  }

  const handleRemoveFieldFromBlock = (index: number) => {
    setBlockFields(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleMoveBlockField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === blockFields.length - 1) return

    const targetIdx = direction === 'up' ? index - 1 : index + 1
    setBlockFields(prev => {
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[targetIdx]
      updated[targetIdx] = temp
      return updated
    })
  }

  const handleUpdateBlockFieldProp = (index: number, prop: string, value: any) => {
    setBlockFields(prev => 
      prev.map((f, idx) => idx === index ? { ...f, [prop]: value } : f)
    )
  }

  const handleSaveBlock = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault()
    if (!blockName.trim()) {
      toast.error('블록 이름을 입력해 주세요.')
      return
    }
    if (blockFields.length === 0) {
      toast.error('블록에 최소 1개 이상의 필드를 추가해 주세요.')
      return
    }

    setIsSavingBlock(true)
    try {
      let updatedBlocks = [...fieldBlocks]
      const newBlock = {
        id: editingBlock ? editingBlock.id : `block_${Date.now()}`,
        name: blockName.trim(),
        description: blockDescription.trim(),
        fields: blockFields
      }

      if (editingBlock) {
        updatedBlocks = updatedBlocks.map(b => b.id === editingBlock.id ? newBlock : b)
      } else {
        updatedBlocks.push(newBlock)
      }

      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'field_blocks', value: updatedBlocks })
      
      if (error) throw error
      
      setFieldBlocks(updatedBlocks)
      setInitialBlockName(blockName.trim())
      setInitialBlockDescription(blockDescription.trim())
      setInitialBlockFields(JSON.parse(JSON.stringify(blockFields)))
      setIsEditingBlockView(false)
      toast.success(editingBlock ? '필드 블록이 수정되었습니다.' : '새 필드 블록이 생성되었습니다.')
    } catch (err: any) {
      console.error(err)
      toast.error('블록 저장에 실패했습니다.')
    } finally {
      setIsSavingBlock(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('정말로 이 필드 블록을 삭제하시겠습니까? 이 동작은 블록 구성 설정만 제거하며 개별 필드는 삭제되지 않습니다.')) {
      return
    }

    try {
      const updatedBlocks = fieldBlocks.filter(b => b.id !== blockId)
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'field_blocks', value: updatedBlocks })
      
      if (error) throw error

      setFieldBlocks(updatedBlocks)
      toast.success('필드 블록이 삭제되었습니다.')
    } catch (err: any) {
      console.error(err)
      toast.error('블록 삭제에 실패했습니다.')
    }
  }
  const handleDelete = async (fieldId: string) => {
    if (!confirm('정말로 이 필드를 삭제하시겠습니까? 이 동작은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      toast.loading('사용 여부 확인 중...', { id: 'field-delete' })
      const { data: usage, error: usageError } = await supabase
        .from('form_template_fields')
        .select('id, form_templates(name)')
        .eq('field_library_id', fieldId)

      if (usageError) throw usageError

      if (usage && usage.length > 0) {
        const templates = Array.from(new Set(usage.map((u: any) => u.form_templates?.name).filter(Boolean)))
        toast.error(`이 필드는 현재 다음 폼 템플릿에서 사용 중이므로 삭제할 수 없습니다:\n${templates.join(', ')}`, { id: 'field-delete' })
        return
      }

      toast.loading('필드 라이브러리에서 삭제 중...', { id: 'field-delete' })
      await deleteMutation.mutateAsync(fieldId)
      toast.success('필드가 성공적으로 삭제되었습니다.', { id: 'field-delete' })
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '필드 삭제에 실패했습니다.', { id: 'field-delete' })
    }
  }

  const handleUpdateField = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingField || !editLabel.trim() || !editCategory.trim()) {
      toast.error('필수 항목을 기입해 주세요.')
      return
    }

    setIsUpdating(true)
    try {
      const choices = editingField.field_type === 'select_text'
        ? editSelectTextChoices.map((s) => s.trim()).filter(Boolean)
        : (editingField.field_type === 'select' || editingField.field_type === 'rselect' || editingField.field_type === 'mselect')
          ? editChoices.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
          : []

      await updateMutation.mutateAsync({
        fieldId: editingField.id,
        updates: {
          label: editLabel.trim(),
          help_text: editHelpText.trim() || null,
          category: editCategory.trim() as any,
          is_system: editIsSystem,
          validation_rules: { ...editingField.validation_rules, choices },
        }
      })
      toast.success('필드 스펙이 성공적으로 변경되었습니다.')
      setIsEditOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '필드 수정 중 오류가 발생했습니다.')
    } finally {
      setIsUpdating(false)
    }
  }

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
      const choices = newType === 'select_text'
        ? newSelectTextChoices.map((s) => s.trim()).filter(Boolean)
        : (newType === 'select' || newType === 'rselect' || newType === 'mselect')
          ? newChoices.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
          : []

      await createMutation.mutateAsync({
        field_key: newKey,
        label: newLabel,
        help_text: newHelpText || null,
        field_type: newType,
        category: newCategory as any,
        is_system: newIsSystem,
        validation_rules: { choices },
      })
      toast.success('커스텀 필드가 필드 라이브러리에 추가되었습니다.')
      setIsOpen(false)
      // reset form
      setNewKey('')
      setNewLabel('')
      setNewHelpText('')
      setNewChoices('')
      setNewIsSystem(false)
      setIsCustomCategory(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '필드 추가 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Dynamic categories list for tabs/filters
  const categories = React.useMemo(() => ['all', ...availableCategories], [availableCategories])

  const filteredFields = fields?.filter((f) => {
    const matchesSearch = 
      f.label.toLowerCase().includes(search.toLowerCase()) || 
      f.field_key.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || f.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const sortedFields = React.useMemo(() => {
    if (!filteredFields) return []
    const sorted = [...filteredFields]
    if (!sortField) return sorted

    sorted.sort((a, b) => {
      let valA = (a[sortField] || '').toLowerCase()
      let valB = (b[sortField] || '').toLowerCase()
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredFields, sortField, sortOrder])

  if (isEditingBlockView) {
    return (
      <div className="space-y-6 font-sans">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={handleCloseBlockEditor}
              className="h-9 w-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {editingBlock ? '필드 블록 수정' : '새 필드 블록 생성'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                폼 빌더에서 원클릭으로 한 번에 배치할 수 있는 필드 꾸러미(블록)를 설정합니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={handleCloseBlockEditor} disabled={isSavingBlock}>
              취소
            </Button>
            <Button type="button" onClick={() => handleSaveBlock()} disabled={isSavingBlock}>
              {isSavingBlock ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editingBlock ? '수정완료' : '블록 생성'}
            </Button>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={(e) => { e.preventDefault(); handleSaveBlock(); }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field>
                <FieldLabel htmlFor="blockName" className="text-xs font-semibold text-foreground">블록 이름 *</FieldLabel>
                <Input
                  id="blockName"
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value)}
                  placeholder="예: 기본 신랑 정보 블록"
                  required
                  maxLength={50}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="blockDescription" className="text-xs font-semibold text-foreground">블록 설명</FieldLabel>
                <Input
                  id="blockDescription"
                  value={blockDescription}
                  onChange={(e) => setBlockDescription(e.target.value)}
                  placeholder="이 블록의 수집 목적이나 포함 정보 설명"
                  maxLength={150}
                />
              </Field>
            </div>

            <div className="border-t border-border/80 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> 포함할 필드 구성 ({blockFields.length}개)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    블록에 구성할 필드들의 순서, 한글 라벨(선택), 그리고 배치될 폼 내의 섹션명/페이지명을 넓은 화면에서 지정합니다.
                  </p>
                </div>

                <div className="w-72 shrink-0">
                  <Select value="" onValueChange={handleAddFieldToBlock}>
                    <SelectTrigger className="h-9 text-xs bg-muted/40 hover:bg-muted/80">
                      <SelectValue placeholder="+ 필드 라이브러리에서 필드 추가" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields?.map(f => (
                        <SelectItem 
                          key={f.id} 
                          value={f.field_key}
                          disabled={blockFields.some(bf => bf.field_key === f.field_key)}
                        >
                          [{f.category}] {f.label} ({f.field_key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg overflow-x-auto bg-card">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[80px] text-center">순서</TableHead>
                      <TableHead className="w-[180px]">기본 필드 정보</TableHead>
                      <TableHead className="min-w-[200px]">라벨명 변경 (선택)</TableHead>
                      <TableHead className="w-[180px]">소속 섹션명</TableHead>
                      <TableHead className="w-[180px]">소속 페이지명</TableHead>
                      <TableHead className="w-[90px] text-center">필수 여부</TableHead>
                      <TableHead className="w-[110px] text-center">하위 연동</TableHead>
                      <TableHead className="w-[80px] text-center">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockFields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs">
                          추가된 필드가 없습니다. 우측 상단 메뉴에서 필드를 선택해 추가해 주세요.
                        </TableCell>
                      </TableRow>
                    ) : (
                      blockFields.map((bf, index) => {
                        const libF = fields?.find(f => f.field_key === bf.field_key)
                        const isExpanded = expandedLinkKey === bf.field_key
                        const hasParent = !!bf.parent_field_key
                        return (
                          <React.Fragment key={index}>
                            <TableRow className="hover:bg-muted/5">
                              <TableCell className="text-center align-middle">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 hover:bg-muted"
                                    onClick={() => handleMoveBlockField(index, 'up')}
                                    disabled={index === 0}
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 hover:bg-muted"
                                    onClick={() => handleMoveBlockField(index, 'down')}
                                    disabled={index === blockFields.length - 1}
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>

                              <TableCell className="align-middle">
                                <div>
                                  <span className="font-semibold text-xs text-foreground block truncate max-w-[170px]">
                                    {libF?.label || bf.field_key}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono truncate block mt-0.5 max-w-[170px]">
                                    {bf.field_key}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="align-middle">
                                <Input
                                  value={bf.label_override || ''}
                                  onChange={(e) => handleUpdateBlockFieldProp(index, 'label_override', e.target.value)}
                                  placeholder={libF?.label || '기본 라벨 사용'}
                                  className="h-8 text-xs px-2 w-full bg-background"
                                  maxLength={100}
                                />
                              </TableCell>

                              <TableCell className="align-middle">
                                <Input
                                  value={bf.section_title || ''}
                                  onChange={(e) => handleUpdateBlockFieldProp(index, 'section_title', e.target.value)}
                                  placeholder="예: 신랑 정보"
                                  className="h-8 text-xs px-2 w-full bg-background"
                                  maxLength={100}
                                />
                              </TableCell>

                              <TableCell className="align-middle">
                                <Input
                                  value={bf.page_title || ''}
                                  onChange={(e) => handleUpdateBlockFieldProp(index, 'page_title', e.target.value)}
                                  placeholder="예: 1단계: 신랑신부"
                                  className="h-8 text-xs px-2 w-full bg-background"
                                  maxLength={100}
                                />
                              </TableCell>

                              <TableCell className="text-center align-middle">
                                <div className="flex justify-center">
                                  <Switch
                                    checked={bf.is_required || false}
                                    onCheckedChange={(checked) => handleUpdateBlockFieldProp(index, 'is_required', checked)}
                                    aria-label="필수 입력 여부"
                                  />
                                </div>
                              </TableCell>

                              <TableCell className="text-center align-middle">
                                <div className="flex justify-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpandedLinkKey(isExpanded ? null : bf.field_key)}
                                    className={`h-8 px-2 gap-1 text-xs shrink-0 ${
                                      hasParent 
                                        ? 'text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary font-semibold' 
                                        : 'text-muted-foreground hover:bg-muted/10'
                                    }`}
                                  >
                                    <Link2 className="w-3.5 h-3.5" />
                                    {hasParent ? '연동됨' : '설정'}
                                  </Button>
                                </div>
                              </TableCell>

                              <TableCell className="text-center align-middle">
                                <div className="flex justify-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveFieldFromBlock(index)}
                                    className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10 shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow className="bg-muted/5 border-b border-border">
                                <TableCell colSpan={8} className="p-4 bg-muted/5">
                                  <div className="flex flex-col md:flex-row gap-6 items-start">
                                    <div className="flex flex-col gap-1 mt-1 md:mt-2.5 shrink-0 max-w-[200px]">
                                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                        <Link2 className="w-4 h-4" />
                                        하위 질문 연동 설정
                                      </div>
                                      <p className="text-[10px] text-muted-foreground leading-relaxed font-normal">
                                        상위 질문의 특정 선택지 답변 시에만 본 필드가 화면에 노출되도록 필터링 규칙을 설정합니다.
                                      </p>
                                    </div>
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                      <Field>
                                        <FieldLabel className="text-[10px] font-semibold text-muted-foreground mb-1">
                                          상위 질문 필드 (선택)
                                        </FieldLabel>
                                        <Select 
                                          value={bf.parent_field_key || 'none'} 
                                          onValueChange={(val) => {
                                            const parentKey = val === 'none' ? null : val
                                            handleUpdateBlockFieldProp(index, 'parent_field_key', parentKey)
                                            handleUpdateBlockFieldProp(index, 'parent_trigger_option', null)
                                          }}
                                        >
                                          <SelectTrigger className="h-8.5 text-xs bg-background border-border">
                                            <SelectValue placeholder="상위 질문 선택 안 함" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">선택 안 함 (일반 질문)</SelectItem>
                                            {blockFields
                                              .slice(0, index)
                                              .filter(otherBf => {
                                                const otherLib = fields?.find(f => f.field_key === otherBf.field_key)
                                                return otherLib && (
                                                  otherLib.field_type === 'select' || 
                                                  otherLib.field_type === 'rselect' || 
                                                  otherLib.field_type === 'toggle'
                                                )
                                              })
                                              .map(otherBf => {
                                                const otherLib = fields?.find(f => f.field_key === otherBf.field_key)
                                                return (
                                                  <SelectItem key={otherBf.field_key} value={otherBf.field_key}>
                                                    [{otherLib?.category || '일반'}] {otherBf.label_override || otherLib?.label || otherBf.field_key} ({otherBf.field_key})
                                                  </SelectItem>
                                                )
                                              })
                                            }
                                          </SelectContent>
                                        </Select>
                                      </Field>

                                      {bf.parent_field_key && (() => {
                                        const parentField = blockFields.find(p => p.field_key === bf.parent_field_key)
                                        const parentLib = fields?.find(f => f.field_key === bf.parent_field_key)
                                        if (!parentField || !parentLib) return null

                                        const isParentToggle = parentLib.field_type === 'toggle'
                                        const parentChoices = isParentToggle 
                                          ? ['on', 'off'] 
                                          : (parentLib.validation_rules?.choices || [])

                                        return (
                                          <Field>
                                            <FieldLabel className="text-[10px] font-semibold text-muted-foreground mb-1">
                                              활성화 조건 선택지값 (Trigger Option)
                                            </FieldLabel>
                                            {parentChoices.length > 0 ? (
                                              <Select
                                                value={bf.parent_trigger_option || ''}
                                                onValueChange={(val) => {
                                                  handleUpdateBlockFieldProp(index, 'parent_trigger_option', val)
                                                }}
                                              >
                                                <SelectTrigger className="h-8.5 text-xs bg-background border-border">
                                                  <SelectValue placeholder="노출 조건 선택지 지정" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {parentChoices.map((choice: string) => (
                                                    <SelectItem key={choice} value={choice}>
                                                      {isParentToggle 
                                                        ? (choice === 'on' ? '예 (ON)' : '아니오 (OFF)') 
                                                        : choice
                                                      }
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <Input
                                                value={bf.parent_trigger_option || ''}
                                                onChange={(e) => handleUpdateBlockFieldProp(index, 'parent_trigger_option', e.target.value)}
                                                placeholder="선택지 직접 입력"
                                                className="h-8.5 text-xs bg-background border-border"
                                              />
                                            )}
                                          </Field>
                                        )
                                      })()}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border">
              <Button type="button" variant="outline" onClick={handleCloseBlockEditor} disabled={isSavingBlock}>
                취소
              </Button>
              <Button type="submit" disabled={isSavingBlock}>
                {isSavingBlock ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingBlock ? '수정완료' : '블록 생성'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    )
  }

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
            <p className="text-sm text-muted-foreground mt-1">지류 및 모바일 청첩장에 사용되는 모든 공통 입력 항목 데이터 규격 및 블록 구성을 정의합니다</p>
          </div>
        </div>

        {activeTab === 'fields' ? (
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
                      maxLength={50}
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
                      maxLength={100}
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
                          <SelectItem value="rselect">라디오 선택 (rselect)</SelectItem>
                          <SelectItem value="toggle">토글 스위치 (toggle)</SelectItem>
                          <SelectItem value="images">다중 이미지 업로드 (images)</SelectItem>
                          <SelectItem value="music">음원 선택 (music)</SelectItem>
                          <SelectItem value="select_text">선택지 또는 직접입력 (select_text)</SelectItem>
                          <SelectItem value="timentext">시간 & 텍스트 세트 / 식순 (timentext)</SelectItem>
                          <SelectItem value="imageselect">이미지 선택형 (imageselect)</SelectItem>
                          <SelectItem value="mselect">다중 선택형 (mselect)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="newCategory">카테고리 *</FieldLabel>
                      {isCustomCategory ? (
                        <div className="flex gap-2">
                          <Input
                            id="newCategory"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="새 카테고리명 입력"
                            className="h-9 text-xs"
                            required
                            maxLength={50}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsCustomCategory(false)
                              setNewCategory('신랑 정보')
                            }}
                            className="h-9 text-xs shrink-0"
                          >
                            목록 선택
                          </Button>
                        </div>
                      ) : (
                        <Select value={newCategory} onValueChange={(val) => {
                          if (val === 'custom') {
                            setIsCustomCategory(true)
                            setNewCategory('')
                          } else {
                            setNewCategory(val)
                          }
                        }}>
                          <SelectTrigger id="newCategory">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                            <SelectItem value="custom" className="text-primary font-semibold">+ 직접 입력 (카테고리 추가)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="newHelpText">안내 문구 (Help Text)</FieldLabel>
                      <Input
                        id="newHelpText"
                        value={newHelpText}
                        onChange={(e) => setNewHelpText(e.target.value)}
                        placeholder="도움말 문구"
                        maxLength={300}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="newIsSystem">필드 성격 *</FieldLabel>
                      <Select value={newIsSystem ? 'true' : 'false'} onValueChange={(val) => setNewIsSystem(val === 'true')}>
                        <SelectTrigger id="newIsSystem">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">커스텀 필드 (Custom)</SelectItem>
                          <SelectItem value="true">시스템 필드 (System)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  {(newType === 'select' || newType === 'rselect' || newType === 'mselect') && (
                    <Field className="mt-2">
                      <FieldLabel htmlFor="newChoices">선택지 목록 설정 *</FieldLabel>
                      <Textarea
                        id="newChoices"
                        value={newChoices}
                        onChange={(e) => setNewChoices(e.target.value)}
                        placeholder="선택지들을 줄바꿈(엔터) 혹은 쉼표(,)로 구분해 기입해 주세요."
                        rows={3}
                        className="text-xs"
                        required
                        maxLength={1000}
                      />
                    </Field>
                  )}
                  {newType === 'select_text' && (
                    <Field className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <FieldLabel>추천 인사말 / 문구 선택지 설정 *</FieldLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => setNewSelectTextChoices(prev => [...prev, ''])}
                        >
                          <Plus className="w-3 h-3" /> 새 선택지 추가
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {newSelectTextChoices.map((choice, idx) => (
                          <div key={idx} className="flex items-start gap-2 bg-muted/20 p-2 rounded border border-border">
                            <Textarea
                              value={choice}
                              placeholder={`추천 인사말 ${idx + 1} 내용 (줄바꿈 가능)`}
                              rows={2}
                              onChange={(e) => {
                                const updated = [...newSelectTextChoices];
                                updated[idx] = e.target.value;
                                setNewSelectTextChoices(updated);
                              }}
                              className="text-xs flex-1 bg-background resize-y min-h-[50px]"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive shrink-0 mt-1 hover:bg-destructive/10"
                              onClick={() => setNewSelectTextChoices(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Field>
                  )}
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
        ) : (
          <Button onClick={handleOpenBlockCreate} className="gap-2">
            <Plus className="w-4 h-4" /> 필드 블록 생성
          </Button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('fields')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'fields'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          개별 필드 관리
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('blocks')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'blocks'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          필드 블록 관리
        </button>
      </div>

      {activeTab === 'fields' ? (
        <div className="space-y-6">
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
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort('label')}
                    >
                      <div className="flex items-center gap-1.5">
                        라벨명 / 도움말
                        {sortField === 'label' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort('field_key')}
                    >
                      <div className="flex items-center gap-1.5">
                        영문 필드 키
                        {sortField === 'field_key' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort('field_type')}
                    >
                      <div className="flex items-center gap-1.5">
                        필드 타입
                        {sortField === 'field_type' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center gap-1.5">
                        카테고리
                        {sortField === 'category' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="w-28 text-center">성격</TableHead>
                    <TableHead className="w-20 text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        필드 라이브러리를 불러오는 중입니다...
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-destructive">
                        필드를 불러오는데 오류가 발생했습니다.
                      </TableCell>
                    </TableRow>
                  ) : sortedFields?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        검색 결과가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedFields?.map((field) => (
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
                            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">시스템</Badge>
                          ) : (
                            <Badge variant="secondary">커스텀</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(field)}>
                              <Settings className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            {!field.is_system && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => handleDelete(field.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>커스텀 필드 수정</DialogTitle>
                <DialogDescription>
                  지정한 정보 수집 규격 속성을 변경합니다.
                </DialogDescription>
              </DialogHeader>
              {editingField && (
                <form onSubmit={handleUpdateField}>
                  <FieldGroup className="space-y-4">
                    <Field>
                      <FieldLabel>영문 필드 키 (field_key)</FieldLabel>
                      <Input
                        value={editingField.field_key}
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        영문 키는 데이터베이스 무결성을 위해 수정이 불가능합니다.
                      </p>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="editLabel">필드 한글 라벨 *</FieldLabel>
                      <Input
                        id="editLabel"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="라벨"
                        required
                        className="h-9 text-xs"
                        maxLength={100}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="editCategory">카테고리 *</FieldLabel>
                      {isEditCustomCategory ? (
                        <div className="flex gap-2">
                          <Input
                            id="editCategory"
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            placeholder="새 카테고리명 입력"
                            className="h-9 text-xs"
                            required
                            maxLength={50}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditCustomCategory(false)
                              setEditCategory('신랑 정보')
                            }}
                            className="h-9 text-xs shrink-0"
                          >
                            목록 선택
                          </Button>
                        </div>
                      ) : (
                        <Select value={editCategory} onValueChange={(val) => {
                          if (val === 'custom') {
                            setIsEditCustomCategory(true)
                            setEditCategory('')
                          } else {
                            setEditCategory(val)
                          }
                        }}>
                          <SelectTrigger id="editCategory">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                            <SelectItem value="custom" className="text-primary font-semibold">+ 직접 입력 (카테고리 추가)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="editHelpText">안내 문구 (Help Text)</FieldLabel>
                        <Input
                          id="editHelpText"
                          value={editHelpText}
                          onChange={(e) => setEditHelpText(e.target.value)}
                          placeholder="도움말 문구"
                          className="h-9 text-xs"
                          maxLength={300}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="editIsSystem">필드 성격 *</FieldLabel>
                        <Select value={editIsSystem ? 'true' : 'false'} onValueChange={(val) => setEditIsSystem(val === 'true')}>
                          <SelectTrigger id="editIsSystem">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">커스텀 필드 (Custom)</SelectItem>
                            <SelectItem value="true">시스템 필드 (System)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {editingField && (editingField.field_type === 'select' || editingField.field_type === 'rselect' || editingField.field_type === 'mselect') && (
                      <Field className="mt-2">
                        <FieldLabel htmlFor="editChoices">선택지 목록 설정 *</FieldLabel>
                        <Textarea
                          id="editChoices"
                          value={editChoices}
                          onChange={(e) => setEditChoices(e.target.value)}
                          placeholder="선택지들을 줄바꿈(엔터) 혹은 쉼표(,)로 구분해 기입해 주세요."
                          rows={3}
                          className="text-xs"
                          required
                          maxLength={1000}
                        />
                      </Field>
                    )}
                    {editingField && editingField.field_type === 'select_text' && (
                      <Field className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <FieldLabel>추천 인사말 / 문구 선택지 설정 *</FieldLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2 gap-1"
                            onClick={() => setEditSelectTextChoices(prev => [...prev, ''])}
                          >
                            <Plus className="w-3 h-3" /> 새 선택지 추가
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {editSelectTextChoices.map((choice, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-muted/20 p-2 rounded border border-border">
                              <Textarea
                                value={choice}
                                placeholder={`추천 인사말 ${idx + 1} 내용 (줄바꿈 가능)`}
                                rows={2}
                                onChange={(e) => {
                                  const updated = [...editSelectTextChoices];
                                  updated[idx] = e.target.value;
                                  setEditSelectTextChoices(updated);
                                }}
                                className="text-xs flex-1 bg-background resize-y min-h-[50px]"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive shrink-0 mt-1 hover:bg-destructive/10"
                                onClick={() => setEditSelectTextChoices(prev => prev.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </Field>
                    )}
                  </FieldGroup>
                  <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
                    <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isUpdating}>
                      취소
                    </Button>
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      수정하기
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Blocks Table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                    <TableRow>
                      <TableHead className="bg-background">블록 이름 / 설명</TableHead>
                      <TableHead className="bg-background">포함된 필드 구성</TableHead>
                      <TableHead className="w-24 text-right bg-background">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {isLoadingBlocks ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        블록 목록을 불러오는 중입니다...
                      </TableCell>
                    </TableRow>
                  ) : fieldBlocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        생성된 필드 블록이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    fieldBlocks.map((block) => (
                      <TableRow key={block.id} className="hover:bg-muted/10">
                        <TableCell className="align-top py-4">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{block.name}</p>
                            {block.description && (
                              <p className="text-xs text-muted-foreground mt-1 max-w-sm">{block.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-xl">
                            {block.fields?.map((f: any, idx: number) => {
                              const libF = fields?.find(lf => lf.field_key === f.field_key)
                              return (
                                <Badge key={idx} variant="outline" className="text-xs py-0.5 px-2 bg-muted/20 border-border">
                                  {f.label_override || libF?.label || f.field_key}
                                  {f.is_required && <span className="text-destructive ml-0.5 font-bold">*</span>}
                                </Badge>
                              )
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right align-middle py-4">
                          <div className="flex justify-end gap-1.5">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenBlockEdit(block)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteBlock(block.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive/90"
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
            </div>
          </CardContent>
          </Card>


        </div>
      )}
    </div>
  )
}
