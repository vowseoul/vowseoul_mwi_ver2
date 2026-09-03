'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Download, Link2, Loader2, QrCode, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useInvitationsQuery } from '@/hooks/queries/useInvitations'
import { renderQrSvg, renderQrPngBlob, svgToDataUri } from '@/lib/qr-code'
import { supabase } from '@/lib/supabase'
import {
  DATA_RETENTION_SETTINGS_KEY, DEFAULT_RETENTION_DAYS, formatExpiryNotice, parseRetentionSettings,
} from '@/lib/data-retention'
import { useDocumentTitle } from '@/lib/use-document-title'
import { cn } from '@/lib/utils'

interface QrLink {
  code: string
  targetUrl: string | null
  createdAt: string
  updatedAt: string
  invitation: {
    id: string
    slug: string
    status: string
    deleted: boolean
    groomName: string | null
    brideName: string | null
    weddingDate: string | null
  } | null
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 발급된 QR 코드 한자리 관리.
 *
 * 인쇄물은 회수할 수 없다. 그래서 "이 종이가 지금 어디로 가는가"를 언제든 확인하고
 * 바꿀 수 있어야 한다 — 청첩장 편집기 안에만 두면 이미 파기된 청첩장에 붙은 QR은
 * 열어볼 화면 자체가 사라진다.
 */
export default function QrLinksPage() {
  useDocumentTitle('QR코드 관리')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<QrLink | null>(null)
  const queryClient = useQueryClient()

  const { data: links } = useQuery<QrLink[]>({
    queryKey: ['qr-links'],
    queryFn: async () => {
      const res = await fetch('/api/admin/qr-link')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || '목록을 불러오지 못했습니다.')
      return body.links
    },
  })

  // 보관일수는 관리자가 바꿀 수 있어 상수로 박아둘 수 없다 — 값을 늘려도 목록의
  // 만료일만 옛 날짜로 남으면 그게 가장 나쁘다.
  const { data: retentionDays = DEFAULT_RETENTION_DAYS } = useQuery({
    queryKey: ['data-retention-days'],
    queryFn: async () => {
      const { data } = await supabase
        .from('settings').select('value').eq('key', DATA_RETENTION_SETTINGS_KEY).maybeSingle()
      return parseRetentionSettings(data?.value).daysAfterWedding
    },
  })

  const filtered = useMemo(() => {
    if (!links) return null
    const term = search.trim().toLowerCase()
    if (!term) return links
    return links.filter((l) =>
      [l.code, l.targetUrl, l.invitation?.slug, l.invitation?.groomName, l.invitation?.brideName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    )
  }, [links, search])

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="뒤로가기">
            <Link href="/admin/invitations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">QR코드 관리</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              인쇄된 QR이 지금 어디로 연결되는지 확인하고, 필요하면 다른 청첩장이나 주소로 옮깁니다.
            </p>
          </div>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="코드·신랑신부·주소 검색"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      {!filtered ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex h-56 flex-col items-center justify-center gap-2 text-center">
            <QrCode className="h-9 w-9 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {links?.length === 0 ? '발급된 QR코드가 없습니다.' : '검색 결과가 없습니다.'}
            </p>
            {links?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                청첩장 편집기에서 QR코드 생성을 열면 그때 코드가 발급됩니다.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((link) => (
            <QrRow
              key={link.code}
              link={link}
              retentionDays={retentionDays}
              onOpen={() => setSelected(link)}
            />
          ))}
        </div>
      )}

      {selected && (
        <QrDetailDialog
          link={selected}
          retentionDays={retentionDays}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await queryClient.invalidateQueries({ queryKey: ['qr-links'] })
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

/** 목록 한 줄 — 무엇에 연결됐고 언제까지 살아 있는지 */
function QrRow({
  link,
  retentionDays,
  onOpen,
}: {
  link: QrLink
  retentionDays: number
  onOpen: () => void
}) {
  const expiry = formatExpiryNotice(link.invitation?.weddingDate, retentionDays)
  const dead = link.invitation?.deleted || (!link.invitation && !link.targetUrl)
  const svg = useMemo(
    () => (typeof window === 'undefined' ? null : renderQrSvg(`${window.location.origin}/q/${link.code}`)),
    [link.code],
  )

  return (
    <Card className={cn('transition-colors hover:border-primary/40', dead && 'border-destructive/40')}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-lg border bg-white p-1.5 transition-transform hover:scale-105"
          aria-label={`${link.code} QR코드 열기`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {svg && <img src={svgToDataUri(svg)} alt="" className="h-20 w-20" />}
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-semibold">{link.code}</code>
            {dead && <Badge variant="destructive" className="text-[10px]">연결 끊김</Badge>}
            {link.targetUrl && <Badge variant="secondary" className="text-[10px]">외부 주소</Badge>}
          </div>

          {link.targetUrl ? (
            <p className="truncate text-sm text-foreground" title={link.targetUrl}>{link.targetUrl}</p>
          ) : link.invitation ? (
            <>
              <p className="truncate text-sm font-medium text-foreground">
                {link.invitation.groomName} ♥ {link.invitation.brideName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                /w/{link.invitation.slug}
                {link.invitation.weddingDate ? ` · 예식 ${link.invitation.weddingDate}` : ''}
                {expiry ? ` · ${expiry.label}까지` : ''}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">연결된 청첩장이 없습니다.</p>
          )}
        </div>

        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onOpen}>
          <Link2 className="h-3.5 w-3.5" /> 링크 변경하기
        </Button>
      </CardContent>
    </Card>
  )
}

/** QR 내려받기 + 연결 변경 */
function QrDetailDialog({
  link,
  retentionDays,
  onClose,
  onChanged,
}: {
  link: QrLink
  retentionDays: number
  onClose: () => void
  onChanged: () => void
}) {
  const { data: invitations } = useInvitationsQuery()
  const [mode, setMode] = useState<'invitation' | 'url'>(link.targetUrl ? 'url' : 'invitation')
  const [invitationId, setInvitationId] = useState(link.invitation?.id ?? '')
  const [url, setUrl] = useState(link.targetUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const qrUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/q/${link.code}`
  const svg = useMemo(() => (qrUrl ? renderQrSvg(qrUrl) : null), [qrUrl])
  const expiry = formatExpiryNotice(link.invitation?.weddingDate, retentionDays)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/qr-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'url'
            ? { code: link.code, targetUrl: url }
            : { code: link.code, invitationId },
        ),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || '연결을 바꾸지 못했습니다.')
        return
      }
      toast.success(
        body.alreadyLinked
          ? '이미 그 대상에 연결돼 있습니다.'
          : '연결을 옮겼습니다. 인쇄물은 그대로 쓰시면 됩니다.',
      )
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR코드 {link.code}</DialogTitle>
          <DialogDescription>
            종이에 인쇄되는 주소는 아래 하나뿐입니다. 연결만 바꾸면 인쇄물은 그대로 씁니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {svg && <img src={svgToDataUri(svg)} alt={`${qrUrl} QR코드`} className="h-48 w-48 rounded-lg border bg-white p-2" />}
          <p className="truncate text-xs font-medium">{qrUrl}</p>
          {expiry && !link.targetUrl && (
            <p className="text-[11px] text-muted-foreground">{expiry.label}까지 연결됩니다</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => svg && downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${link.code}-qr.svg`)}
          >
            <Download className="h-3.5 w-3.5" /> SVG
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true)
              try {
                downloadBlob(await renderQrPngBlob(qrUrl), `${link.code}-qr.png`)
              } catch {
                toast.error('PNG 저장에 실패했습니다.')
              } finally {
                setDownloading(false)
              }
            }}
          >
            <Download className="h-3.5 w-3.5" /> PNG
          </Button>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">링크 변경하기</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'invitation' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('invitation')}
            >
              청첩장 선택
            </Button>
            <Button
              size="sm"
              variant={mode === 'url' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('url')}
            >
              주소 직접 입력
            </Button>
          </div>

          {mode === 'invitation' ? (
            <Select value={invitationId} onValueChange={setInvitationId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="연결할 청첩장 선택" />
              </SelectTrigger>
              <SelectContent>
                {(invitations ?? []).map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.customer?.groom_name} ♥ {inv.customer?.bride_name} · /w/{inv.public_slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/..."
              className="text-sm"
            />
          )}

          <Button
            className="w-full"
            onClick={save}
            disabled={saving || (mode === 'invitation' ? !invitationId : !url.trim())}
          >
            {saving ? '옮기는 중…' : '이 QR의 연결 바꾸기'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
