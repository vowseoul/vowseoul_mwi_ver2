"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Plus, Search, Edit, Trash2, Eye, Copy } from "lucide-react"

const mockTemplates = [
  { id: 1, name: "클래식 로즈", category: "클래식", style: "elegant", price: 49000, status: "active", uses: 234 },
  { id: 2, name: "모던 미니멀", category: "모던", style: "minimal", price: 39000, status: "active", uses: 189 },
  { id: 3, name: "플로럴 가든", category: "플로럴", style: "romantic", price: 55000, status: "active", uses: 156 },
  { id: 4, name: "빈티지 골드", category: "빈티지", style: "elegant", price: 65000, status: "draft", uses: 0 },
  { id: 5, name: "심플 화이트", category: "모던", style: "minimal", price: 35000, status: "active", uses: 312 },
  { id: 6, name: "로맨틱 핑크", category: "로맨틱", style: "romantic", price: 45000, status: "active", uses: 98 },
]

export default function AdminTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredTemplates = mockTemplates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter
    const matchesStatus = statusFilter === "all" || template.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">템플릿 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">청첩장 템플릿을 관리합니다</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              새 템플릿
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>새 템플릿 추가</DialogTitle>
              <DialogDescription>새로운 청첩장 템플릿을 등록합니다</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">템플릿 이름</Label>
                <Input id="name" placeholder="템플릿 이름을 입력하세요" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">카테고리</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">클래식</SelectItem>
                    <SelectItem value="modern">모던</SelectItem>
                    <SelectItem value="floral">플로럴</SelectItem>
                    <SelectItem value="romantic">로맨틱</SelectItem>
                    <SelectItem value="vintage">빈티지</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">가격 (원)</Label>
                <Input id="price" type="number" placeholder="49000" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">활성화</Label>
                <Switch id="active" defaultChecked />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={() => setIsAddDialogOpen(false)}>등록</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="템플릿 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            <SelectItem value="클래식">클래식</SelectItem>
            <SelectItem value="모던">모던</SelectItem>
            <SelectItem value="플로럴">플로럴</SelectItem>
            <SelectItem value="로맨틱">로맨틱</SelectItem>
            <SelectItem value="빈티지">빈티지</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="draft">초안</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="overflow-hidden">
            <div className="aspect-[3/4] bg-muted relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-muted-foreground text-sm">미리보기</span>
              </div>
              <div className="absolute top-3 right-3">
                <Badge variant={template.status === "active" ? "default" : "secondary"}>
                  {template.status === "active" ? "활성" : "초안"}
                </Badge>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium">{template.name}</h3>
                  <p className="text-sm text-muted-foreground">{template.category}</p>
                </div>
                <span className="font-semibold">{template.price.toLocaleString()}원</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">사용: {template.uses}회</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="w-3 h-3 mr-1" />
                  미리보기
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm">
                  <Copy className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
