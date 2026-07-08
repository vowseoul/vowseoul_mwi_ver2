"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, MoreHorizontal, Mail, Ban, Eye, Users, UserCheck, UserX } from "lucide-react"

const mockUsers = [
  { 
    id: 1, 
    name: "김민지", 
    email: "minji@example.com", 
    phone: "010-1234-5678",
    status: "active", 
    invitations: 2, 
    totalSpent: 148000,
    registeredAt: "2024-01-15",
    lastLogin: "2024-03-10"
  },
  { 
    id: 2, 
    name: "이서준", 
    email: "seojun@example.com", 
    phone: "010-2345-6789",
    status: "active", 
    invitations: 1, 
    totalSpent: 65000,
    registeredAt: "2024-02-01",
    lastLogin: "2024-03-09"
  },
  { 
    id: 3, 
    name: "박지은", 
    email: "jieun@example.com", 
    phone: "010-3456-7890",
    status: "inactive", 
    invitations: 3, 
    totalSpent: 195000,
    registeredAt: "2023-11-20",
    lastLogin: "2024-01-15"
  },
  { 
    id: 4, 
    name: "최현우", 
    email: "hyunwoo@example.com", 
    phone: "010-4567-8901",
    status: "active", 
    invitations: 1, 
    totalSpent: 49000,
    registeredAt: "2024-03-01",
    lastLogin: "2024-03-10"
  },
  { 
    id: 5, 
    name: "정유진", 
    email: "yujin@example.com", 
    phone: "010-5678-9012",
    status: "blocked", 
    invitations: 0, 
    totalSpent: 0,
    registeredAt: "2024-02-15",
    lastLogin: "2024-02-20"
  },
]

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalUsers = mockUsers.length
  const activeUsers = mockUsers.filter(u => u.status === "active").length
  const blockedUsers = mockUsers.filter(u => u.status === "blocked").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">회원 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">등록된 회원을 관리합니다</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 회원</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">활성 회원</CardTitle>
            <UserCheck className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeUsers}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">차단 회원</CardTitle>
            <UserX className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{blockedUsers}명</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="이름 또는 이메일로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="inactive">비활성</SelectItem>
            <SelectItem value="blocked">차단</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>회원정보</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead className="text-center">청첩장</TableHead>
                <TableHead className="text-right">총 결제금액</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{user.phone}</TableCell>
                  <TableCell className="text-center">{user.invitations}개</TableCell>
                  <TableCell className="text-right font-medium">
                    {user.totalSpent.toLocaleString()}원
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.registeredAt}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.status === "active"
                          ? "default"
                          : user.status === "blocked"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {user.status === "active" ? "활성" : user.status === "blocked" ? "차단" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          상세보기
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="w-4 h-4 mr-2" />
                          이메일 발송
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Ban className="w-4 h-4 mr-2" />
                          {user.status === "blocked" ? "차단 해제" : "차단"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
