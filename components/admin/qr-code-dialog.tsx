"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, QrCode } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { renderQrSvg, renderQrPngBlob, svgToDataUri } from "@/lib/qr-code"
import { supabase } from "@/lib/supabase"
import {
  DATA_RETENTION_SETTINGS_KEY, DEFAULT_RETENTION_DAYS, formatExpiryNotice, parseRetentionSettings,
} from "@/lib/data-retention"
import { AlertCircle, Link2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

/** Blob/문자열을 파일로 저장시킨다 (a[download] + 임시 objectURL) */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // 즉시 해제하면 브라우저가 다운로드를 시작하기 전에 URL이 사라질 수 있다
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 청첩장 공개 주소를 QR로 만들어 보여주고 SVG/PNG로 내려받게 하는 다이얼로그.
 * QR 생성은 전부 브라우저에서 끝나 서버 왕복이 없다.
 */
export function QrCodeDialog({
  invitationId,
  path,
  fileBaseName,
  weddingDate,
}: {
  invitationId: string
  /** 지금 이 청첩장의 하객용 주소. QR 에는 담기지 않고 "현재 연결"로만 보여준다. */
  path: string
  fileBaseName: string
  /** 만료 안내 계산용. 없으면 안내 대신 "계산할 수 없다"고 알린다. */
  weddingDate?: string
}) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [retentionDays, setRetentionDays] = useState(DEFAULT_RETENTION_DAYS)
  const [code, setCode] = useState<string | null>(null)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [takeoverInput, setTakeoverInput] = useState("")
  const [takingOver, setTakingOver] = useState(false)

  // 보관일수는 관리자가 바꿀 수 있는 값이라 상수로 박아둘 수 없다 — 설정을 늘려도
  // 종이에 인쇄된 안내만 옛 날짜로 남으면 그게 가장 나쁘다.
  useEffect(() => {
    if (!open) return
    void supabase
      .from("settings").select("value").eq("key", DATA_RETENTION_SETTINGS_KEY).maybeSingle()
      .then(({ data }) => setRetentionDays(parseRetentionSettings(data?.value).daysAfterWedding))
  }, [open])

  // 코드는 열어볼 때 발급받는다 — 한 번도 인쇄하지 않을 청첩장 몫까지 미리 쌓지 않는다.
  // 진행 상태를 따로 두지 않고 code/issueError 로만 판단한다 — 효과 본문에서 곧바로
  // setState 하면 렌더가 한 번 더 돈다.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetch(`/api/admin/qr-link?invitationId=${encodeURIComponent(invitationId)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok) setCode(body.code)
        else setIssueError(body.error || "QR 코드를 발급하지 못했습니다.")
      })
      .catch(() => {
        if (!cancelled) setIssueError("QR 코드를 발급하지 못했습니다.")
      })
    return () => {
      cancelled = true
    }
  }, [open, invitationId])

  const expiry = useMemo(
    () => formatExpiryNotice(weddingDate, retentionDays),
    [weddingDate, retentionDays],
  )

  // 열려 있을 때만 계산한다 — 닫힌 상태에서 매 렌더마다 QR을 다시 만들 이유가 없고,
  // origin 도 이때 읽으면 서버 렌더 중 window 접근을 걱정할 필요가 없다.
  // QR 에는 리디렉션 주소만 담는다. 청첩장을 갈아끼워도 종이는 그대로 쓰기 위한
  // 한 겹이다(§app/q/[code]/route.ts). 담는 글자도 짧아져 작게 인쇄해도 잘 읽힌다.
  const { url, svg } = useMemo(() => {
    if (!open || !code) return { url: "", svg: null }
    const full = `${window.location.origin}/q/${code}`
    return { url: full, svg: renderQrSvg(full) }
  }, [open, code])

  const destination = useMemo(
    () => (open ? `${window.location.origin}${path}` : ""),
    [open, path],
  )

  const handleTakeover = async () => {
    setTakingOver(true)
    try {
      const res = await fetch("/api/admin/qr-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: takeoverInput, invitationId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || "연결을 바꾸지 못했습니다.")
        return
      }
      setCode(body.code)
      setTakeoverInput("")
      toast.success(
        body.alreadyLinked
          ? "이미 이 청첩장에 연결된 QR입니다."
          : "인쇄된 QR이 이제 이 청첩장으로 연결됩니다.",
      )
    } finally {
      setTakingOver(false)
    }
  }

  const handleDownloadSvg = () => {
    if (!svg) return
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileBaseName}-qr.svg`)
  }

  const handleDownloadPng = async () => {
    if (!url) return
    setDownloading(true)
    try {
      const blob = await renderQrPngBlob(url)
      downloadBlob(blob, `${fileBaseName}-qr.png`)
    } catch {
      toast.error("PNG 저장에 실패했습니다.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <QrCode className="h-3.5 w-3.5" /> QR코드 생성
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>청첩장 QR코드</DialogTitle>
          <DialogDescription>
            스캔하면 지금 연결된 청첩장이 열립니다. 인쇄물에 넣을 때는 SVG를 쓰면 확대해도 깨지지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          {!svg ? (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg border bg-muted/30 p-4 text-center">
              {issueError ? (
                <p className="text-xs text-destructive">{issueError}</p>
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              )}
            </div>
          ) : (
            <img
              src={svgToDataUri(svg)}
              alt={`${url} 청첩장 QR코드`}
              className="h-56 w-56 rounded-lg border bg-white p-2"
            />
          )}
          <div className="w-full space-y-1 text-center">
            <p className="truncate text-xs font-medium text-foreground" title={url}>
              {url || "발급 중…"}
            </p>
            {/* 종이에 박히는 것과 실제로 열리는 것이 다르다는 걸 여기서 보여준다.
                이게 안 보이면 관리자는 QR 이 왜 바로 청첩장 주소가 아닌지 의아해한다. */}
            <p className="truncate text-[11px] text-muted-foreground" title={destination}>
              현재 연결: {destination}
            </p>
          </div>
        </div>

        {/* 인쇄를 결정하기 전에 알아야 하는 한 가지. QR 자체는 영구적이지만 링크가
            먼저 죽는다 — 예식일 + 보관일수가 지나면 청첩장이 자동 파기된다
            (§app/api/cron/purge-expired-invitations). */}
        <div className="flex gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {expiry ? (
            <p>
              이 QR은 <strong>{expiry.label}</strong>까지 연결됩니다.
              <span className="mt-0.5 block">
                예식일 +{retentionDays}일이 지나면 청첩장이 자동 파기되어 QR을 스캔해도 열리지 않습니다.
              </span>
            </p>
          ) : (
            <p>
              예식일이 입력되지 않아 만료일을 계산할 수 없습니다.
              <span className="mt-0.5 block">
                예식일을 채우면 이 QR이 언제까지 연결되는지 여기에 표시됩니다.
              </span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-2" onClick={handleDownloadSvg} disabled={!svg}>
            <Download className="h-3.5 w-3.5" /> SVG로 다운로드
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleDownloadPng} disabled={downloading || !svg}>
            <Download className="h-3.5 w-3.5" /> PNG로 다운로드
          </Button>
        </div>

        {/* 이 화면의 존재 이유. 이미 인쇄한 QR 을 새 청첩장으로 옮겨 붙인다. */}
        <div className="space-y-2 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Link2 className="h-3.5 w-3.5" /> 이미 인쇄한 QR 이어받기
          </p>
          <p className="text-xs text-muted-foreground">
            청첩장을 새로 만들었다면, 인쇄물의 QR 주소를 넣어 이 청첩장으로 연결을 옮기세요.
            종이는 그대로 쓸 수 있습니다.
          </p>
          <div className="flex gap-2">
            <Input
              value={takeoverInput}
              onChange={(e) => setTakeoverInput(e.target.value)}
              placeholder="인쇄물의 QR 주소 또는 코드"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0"
              onClick={handleTakeover}
              disabled={takingOver || !takeoverInput.trim()}
            >
              연결 옮기기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
