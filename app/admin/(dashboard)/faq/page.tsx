'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAppStore, sampleFaqs, type FAQ } from '@/lib/store'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function AdminFAQPage() {
  const { faqs, setFaqs, addFaq, updateFaq, deleteFaq } = useAppStore()
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    category: '',
    question: '',
    answer: '',
  })

  // Removed sample faqs initialization as data is now fetched from Supabase

  const handleOpenDialog = (faq?: FAQ) => {
    if (faq) {
      setEditingId(faq.id)
      setFormData({
        category: faq.category || '',
        question: faq.question,
        answer: faq.answer,
      })
    } else {
      setEditingId(null)
      setFormData({
        category: '',
        question: '',
        answer: '',
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    if (!formData.question || !formData.answer) {
      toast.error('질문과 답변을 모두 입력해주세요.')
      return
    }

    if (editingId) {
      updateFaq(editingId, {
        question: formData.question,
        answer: formData.answer,
        category: formData.category || '기타',
      })
      toast.success('FAQ가 수정되었습니다.')
    } else {
      addFaq({
        id: `faq_${uuidv4().slice(0, 8)}`,
        question: formData.question,
        answer: formData.answer,
        category: formData.category || '기타',
        createdAt: new Date().toISOString().split('T')[0],
      })
      toast.success('새로운 FAQ가 등록되었습니다.')
    }
    
    setIsDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    if (confirm('정말로 이 FAQ를 삭제하시겠습니까?')) {
      deleteFaq(id)
      toast.success('FAQ가 삭제되었습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">FAQ 관리</h1>
          <p className="text-muted-foreground">자주 묻는 질문을 등록하고 관리합니다.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> FAQ 등록
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">FAQ 목록 ({faqs.length}건)</CardTitle>
          <CardDescription>홈페이지의 자주 묻는 질문 페이지에 표시됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted-foreground">
                  <th className="pb-3 pr-4 w-[100px]">카테고리</th>
                  <th className="pb-3 pr-4">질문</th>
                  <th className="pb-3 pr-4 w-[120px]">등록일</th>
                  <th className="pb-3 w-[100px] text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq) => (
                  <tr key={faq.id} className="border-b border-border last:border-0 group">
                    <td className="py-4 pr-4 text-sm whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                        {faq.category || '기타'}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="text-sm font-medium mb-1">{faq.question}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">{faq.answer}</div>
                    </td>
                    <td className="py-4 pr-4 text-sm text-muted-foreground whitespace-nowrap">
                      {faq.createdAt}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(faq)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">수정</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(faq.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">삭제</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {faqs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      등록된 FAQ가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'FAQ 수정' : '새 FAQ 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category">카테고리</Label>
              <Input
                id="category"
                placeholder="예: 결제, 제작, 수정 등"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="question">질문 <span className="text-destructive">*</span></Label>
              <Input
                id="question"
                placeholder="질문을 입력하세요"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">답변 <span className="text-destructive">*</span></Label>
              <Textarea
                id="answer"
                placeholder="답변을 입력하세요"
                className="min-h-[150px]"
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
