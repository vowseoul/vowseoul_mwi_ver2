"use client"

import { useMemo, useState } from "react"
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
export function QrCodeDialog({ path, fileBaseName }: { path: string; fileBaseName: string }) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // 열려 있을 때만 계산한다 — 닫힌 상태에서 매 렌더마다 QR을 다시 만들 이유가 없고,
  // origin 도 이때 읽으면 서버 렌더 중 window 접근을 걱정할 필요가 없다.
  const { url, svg } = useMemo(() => {
    if (!open) return { url: "", svg: null }
    const full = `${window.location.origin}${path}`
    return { url: full, svg: renderQrSvg(full) }
  }, [open, path])

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
            스캔하면 청첩장이 열립니다. 인쇄물에 넣을 때는 SVG를 쓰면 확대해도 깨지지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          {svg && (
            <img
              src={svgToDataUri(svg)}
              alt={`${url} 청첩장 QR코드`}
              className="h-56 w-56 rounded-lg border bg-white p-2"
            />
          )}
          <p className="w-full truncate text-center text-xs text-muted-foreground" title={url}>
            {url}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-2" onClick={handleDownloadSvg}>
            <Download className="h-3.5 w-3.5" /> SVG로 다운로드
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleDownloadPng} disabled={downloading}>
            <Download className="h-3.5 w-3.5" /> PNG로 다운로드
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
