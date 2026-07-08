'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore, type Notice } from '@/lib/store'
import { Plus, Pencil, Trash2, Save, Search } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function AdminNoticePage() {
  const { notices, addNotice, updateNotice, deleteNotice } = useAppStore()
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '안내',
  })

  const handleOpenDialog = (notice?: Notice) => {
    if (notice) {
      setEditingId(notice.id)
      setFormData({
        title: notice.title,
        content: notice.content,
        category: notice.category || '안내',
      })
    } else {
      setEditingId(null)
      setFormData({
        title: '',
        content: '',
        category: '안내',
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      toast.error('제목과 내용을 모두 입력해주세요.')
      return
    }

    if (editingId) {
      await updateNotice(editingId, {
        title: formData.title,
        content: formData.content,
        category: formData.category,
      })
      toast.success('공지사항이 수정되었습니다.')
    } else {
      await addNotice({
        id: `notice_${uuidv4().slice(0, 8)}`,
        title: formData.title,
        content: formData.content,
        category: formData.category,
        createdAt: new Date().toISOString().split('T')[0],
      })
      toast.success('새로운 공지사항이 등록되었습니다.')
    }
    
    setIsDialogOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      await deleteNotice(id)
      toast.success('공지사항이 삭제되었습니다.')
    }
  }

  // Filter and search notices
  const filteredNotices = notices.filter((notice) => {
    const matchesSearch = 
      notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notice.content.toLowerCase().includes(searchQuery.toLowerCase())
      
    const matchesCategory = filterCategory === 'all' || notice.category === filterCategory
    
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">공지사항 관리</h1>
          <p className="text-muted-foreground">홈페이지의 공지사항을 등록하고 관리합니다.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> 공지 등록
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border">
        <div className="flex flex-1 w-full sm:w-auto items-center gap-2 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground ml-2" />
          <Input 
            placeholder="제목 또는 내용으로 검색..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-9"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Label className="text-sm whitespace-nowrap text-muted-foreground">카테고리 필터:</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="안내">안내</SelectItem>
              <SelectItem value="업데이트">업데이트</SelectItem>
              <SelectItem value="점검">점검</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">공지사항 목록 ({filteredNotices.length}건)</CardTitle>
          <CardDescription>홈페이지의 공지사항 페이지에 실시간으로 표시됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted-foreground">
                  <th className="pb-3 pr-4 w-[120px]">카테고리</th>
                  <th className="pb-3 pr-4">제목</th>
                  <th className="pb-3 pr-4 w-[120px]">등록일</th>
                  <th className="pb-3 w-[100px] text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotices.map((notice) => (
                  <tr key={notice.id} className="border-b border-border last:border-0 group">
                    <td className="py-4 pr-4 text-sm whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        notice.category === '안내' ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                        notice.category === '업데이트' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      )}>
                        {notice.category}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="text-sm font-medium mb-1 line-clamp-1">{notice.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{notice.content}</div>
                    </td>
                    <td className="py-4 pr-4 text-sm text-muted-foreground whitespace-nowrap">
                      {notice.createdAt}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(notice)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">수정</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(notice.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">삭제</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredNotices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      등록된 공지사항이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? '공지사항 수정' : '새 공지사항 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="notice-category">카테고리</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger id="notice-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="안내">안내</SelectItem>
                    <SelectItem value="업데이트">업데이트</SelectItem>
                    <SelectItem value="점검">점검</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notice-title">공지 제목 <span className="text-destructive">*</span></Label>
              <Input
                id="notice-title"
                placeholder="공지사항 제목을 입력하세요"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notice-content">공지 내용 <span className="text-destructive">*</span></Label>
              <Textarea
                id="notice-content"
                placeholder="상세 내용을 입력하세요 (줄바꿈이 정상적으로 표시됩니다)"
                className="min-h-[250px] font-sans text-sm leading-relaxed"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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
