"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { 
  Plus, 
  MoreVertical, 
  Edit, 
  Eye, 
  Copy, 
  Share2, 
  Trash2,
  ExternalLink,
  QrCode,
  BarChart3
} from "lucide-react"

const mockInvitations = [
  {
    id: "inv-001",
    title: "민수 & 서연의 결혼식",
    template: "클래식 로즈",
    status: "published",
    createdAt: "2024-03-01",
    weddingDate: "2024-05-25",
    views: 234,
    rsvpCount: 45,
    url: "vowseoul.com/i/minsu-seoyeon",
  },
  {
    id: "inv-002",
    title: "현우 & 지은의 결혼식",
    template: "모던 미니멀",
    status: "draft",
    createdAt: "2024-03-08",
    weddingDate: "2024-06-15",
    views: 0,
    rsvpCount: 0,
    url: null,
  },
]

export default function MyInvitationsPage() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedInvitation, setSelectedInvitation] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    setSelectedInvitation(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    // Handle delete
    setDeleteDialogOpen(false)
    setSelectedInvitation(null)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 py-12">
        <div className="container max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">내 청첩장</h1>
              <p className="text-sm text-muted-foreground mt-1">
                작성 중인 청첩장과 발행된 청첩장을 관리합니다
              </p>
            </div>
            <Link href="/templates">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                새 청첩장 만들기
              </Button>
            </Link>
          </div>

          {mockInvitations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">아직 청첩장이 없습니다</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center">
                  첫 번째 청첩장을 만들어보세요
                </p>
                <Link href="/templates">
                  <Button>청첩장 만들기</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {mockInvitations.map((invitation) => (
                <Card key={invitation.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      {/* Thumbnail */}
                      <div className="sm:w-48 aspect-[3/4] sm:aspect-auto bg-muted flex-shrink-0">
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                          미리보기
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-lg">{invitation.title}</h3>
                              <Badge variant={invitation.status === "published" ? "default" : "secondary"}>
                                {invitation.status === "published" ? "발행됨" : "작성 중"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {invitation.template} · 예식일: {invitation.weddingDate}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/editor/${invitation.id}`}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  편집
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                미리보기
                              </DropdownMenuItem>
                              {invitation.status === "published" && (
                                <>
                                  <DropdownMenuItem>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    청첩장 열기
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Copy className="w-4 h-4 mr-2" />
                                    링크 복사
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <QrCode className="w-4 h-4 mr-2" />
                                    QR 코드
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                    통계 보기
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleDelete(invitation.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {invitation.status === "published" && (
                          <div className="flex items-center gap-6 mb-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">조회수</span>
                              <span className="ml-2 font-medium">{invitation.views}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">참석 응답</span>
                              <span className="ml-2 font-medium">{invitation.rsvpCount}명</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">링크</span>
                              <span className="ml-2 font-medium text-primary">{invitation.url}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Link href={`/editor/${invitation.id}`}>
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4 mr-2" />
                              편집하기
                            </Button>
                          </Link>
                          {invitation.status === "published" ? (
                            <Button variant="outline" size="sm">
                              <Share2 className="w-4 h-4 mr-2" />
                              공유하기
                            </Button>
                          ) : (
                            <Link href={`/editor/${invitation.id}/payment`}>
                              <Button size="sm">
                                발행하기
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>청첩장을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제된 청첩장은 복구할 수 없습니다. 발행된 청첩장의 경우 더 이상 접근할 수 없게 됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
