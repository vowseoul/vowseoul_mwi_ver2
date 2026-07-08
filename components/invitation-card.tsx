'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Pencil, Share2 } from 'lucide-react'
import type { WeddingInvitation } from '@/lib/store'
import { toast } from 'sonner'

interface InvitationCardProps {
  invitation: WeddingInvitation
}

export function InvitationCard({ invitation }: InvitationCardProps) {
  const statusConfig = {
    draft: { label: '작성중', variant: 'secondary' as const },
    paid: { label: '결제완료', variant: 'outline' as const },
    published: { label: '발행됨', variant: 'default' as const },
    expired: { label: '만료됨', variant: 'destructive' as const },
  }

  const status = statusConfig[invitation.status]

  const handleShare = async () => {
    const link = `${window.location.origin}/invitation/${invitation.id}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('청첩장 링크가 클립보드에 복사되었습니다.')
    } catch {
      toast.error('링크 복사에 실패했습니다.')
    }
  }

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {invitation.mainImage ? (
          <img
            src={invitation.mainImage}
            alt={`${invitation.groomName} & ${invitation.brideName}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="font-serif text-lg">{invitation.groomName}</p>
              <p className="my-1 text-muted-foreground">&amp;</p>
              <p className="font-serif text-lg">{invitation.brideName}</p>
            </div>
          </div>
        )}
        <Badge className="absolute right-3 top-3" variant={status.variant}>
          {status.label}
        </Badge>
      </div>
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-medium">
            {invitation.groomName} & {invitation.brideName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(invitation.weddingDate).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/editor/${invitation.id}`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              편집
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <a href={`/invitation/${invitation.id}`} target="_blank" rel="noopener noreferrer">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              미리보기
            </a>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleShare}
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
