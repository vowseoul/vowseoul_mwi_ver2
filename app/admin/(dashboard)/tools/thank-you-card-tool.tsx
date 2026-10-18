"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Check, Download, ImagePlus, Loader2, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { uploadImage } from "@/lib/image-upload"
import { buildFontStack, fetchRegisteredFonts, fontPreviewStyle, type RegisteredFont } from "@/lib/fonts"
import { useInjectFontFaces } from "@/lib/use-font-faces"
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  DEFAULT_THANK_YOU_NAME,
  DEFAULT_THANK_YOU_TEXT,
  drawThankYouCard,
} from "@/lib/thank-you-card"

const DEFAULT_FONT = "serif"
const API = "/api/admin/thankyou-backgrounds"

/** 한 번 불러온 배경은 다시 내려받지 않는다 — 글자를 칠 때마다 그림을 다시 그린다 */
const imageCache = new Map<string, Promise<HTMLImageElement>>()
function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      // 캔버스에 그린 뒤 파일로 내보내려면 CORS 로 받아야 한다(그렇지 않으면 캔버스가 오염돼 저장이 막힌다)
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("배경 이미지를 불러오지 못했습니다."))
      img.src = url
    })
    imageCache.set(url, p)
    p.catch(() => imageCache.delete(url))
  }
  return p
}

function ColorInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="색 고르기"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
      />
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1" />
    </div>
  )
}

export function ThankYouCardTool() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [backgrounds, setBackgrounds] = useState<string[]>([])
  /** 고른 배경 이미지 주소. null 이면 단색 */
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState("#f7f3ee")
  const [textColor, setTextColor] = useState("#3a3330")
  const [body, setBody] = useState(DEFAULT_THANK_YOU_TEXT)
  const [name, setName] = useState(DEFAULT_THANK_YOU_NAME)
  const [fonts, setFonts] = useState<RegisteredFont[]>([])
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [drawError, setDrawError] = useState("")

  useInjectFontFaces(fonts)

  useEffect(() => {
    fetchRegisteredFonts().then(setFonts)
    fetch(API)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.backgrounds)) setBackgrounds(d.backgrounds) })
      .catch(() => toast.error("배경 이미지 목록을 불러오지 못했습니다."))
  }, [])

  // 입력이 바뀔 때마다 다시 그린다. 미리보기 캔버스가 곧 내보낼 그림이다.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!canvas || !ctx) return
      let img: HTMLImageElement | null = null
      try {
        if (bgImage) img = await loadImage(bgImage)
        setDrawError("")
      } catch (err) {
        setDrawError(err instanceof Error ? err.message : "배경 이미지를 불러오지 못했습니다.")
      }
      // 등록 폰트는 쓰기 전까지 내려받지 않으므로, 그리기 전에 실제로 불러와야 첫 그림부터 그 폰트로 나온다
      try {
        await document.fonts.load(`46px ${fontFamily}`, `${body}${name}`)
      } catch {
        /* 폰트를 못 불러오면 대체 글꼴로 그린다 */
      }
      if (cancelled) return
      drawThankYouCard(ctx, { backgroundImage: img, backgroundColor: bgColor, textColor, fontFamily, body, name })
    })()
    return () => { cancelled = true }
  }, [bgImage, bgColor, textColor, fontFamily, body, name, fonts])

  const uploadBackground = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadImage(file, "tools/thank-you", { maxDimension: 2160, quality: 0.9 })
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "배경을 등록하지 못했습니다.")
      setBackgrounds(data.backgrounds)
      setBgImage(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "배경을 등록하지 못했습니다.")
    } finally {
      setUploading(false)
    }
  }

  const removeBackground = async (url: string) => {
    if (!(await confirmDialog({ title: "이 배경 이미지를 삭제하시겠습니까?", destructive: true, confirmText: "삭제" }))) return
    const res = await fetch(API, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "삭제하지 못했습니다.")
      return
    }
    setBackgrounds(data.backgrounds)
    if (bgImage === url) setBgImage(null)
  }

  const exportImage = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setExporting(true)
    try {
      // 사진 배경은 PNG 로 저장하면 수 MB 가 돼 카톡으로 보내기 무겁다 — JPEG 로 저장한다
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
      if (!blob) throw new Error("이미지를 만들지 못했습니다.")
      const file = new File([blob], "모바일감사장.jpg", { type: "image/jpeg" })
      // 휴대폰에서는 공유 시트로 넘겨야 "이미지 저장"으로 사진첩에 바로 들어간다.
      // PC 는 공유 시트보다 파일 다운로드가 자연스러우므로 터치 기기에서만 공유를 쓴다.
      const isTouch = window.matchMedia("(pointer: coarse)").matches
      if (isTouch && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
          return
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return
          // 공유가 막힌 환경이면 아래 다운로드로 넘어간다
        }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지를 만들지 못했습니다.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">모바일감사장</CardTitle>
        <CardDescription>
          배경과 문구를 고른 뒤 &ldquo;이미지로 내보내기&rdquo;를 누르면 PC에서는 파일로 내려받고, 휴대폰에서는 사진첩에 바로 저장할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <Field>
              <FieldLabel>1. 배경</FieldLabel>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setBgImage(null)}
                  className={cn(
                    "relative flex aspect-[9/16] w-[72px] items-end justify-center rounded-md border p-1.5 text-[11px] text-muted-foreground",
                    bgImage === null && "ring-2 ring-primary ring-offset-2",
                  )}
                  style={{ background: bgColor }}
                  aria-pressed={bgImage === null}
                >
                  <span className="rounded bg-background/80 px-1">단색</span>
                  {bgImage === null && <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" />}
                </button>
                {backgrounds.map((url) => (
                  <div key={url} className="group relative w-[72px]">
                    <button
                      type="button"
                      onClick={() => setBgImage(url)}
                      className={cn(
                        "block aspect-[9/16] w-full overflow-hidden rounded-md border",
                        bgImage === url && "ring-2 ring-primary ring-offset-2",
                      )}
                      aria-pressed={bgImage === url}
                      aria-label="이 배경 사용"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBackground(url)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      aria-label="배경 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <label className="flex aspect-[9/16] w-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-muted-foreground hover:bg-muted/50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  배경 추가
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadBackground(file)
                      e.target.value = ""
                    }}
                  />
                </label>
              </div>
              <FieldDescription>등록한 배경은 모든 직원이 함께 씁니다. 사진은 화면에 꽉 차게 잘려 들어갑니다(세로 9:16).</FieldDescription>
              {bgImage === null && (
                <div className="max-w-xs pt-1">
                  <ColorInput id="tyBgColor" value={bgColor} onChange={setBgColor} />
                </div>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="tyBody">2. 감사장 내용</FieldLabel>
              <Textarea id="tyBody" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setBody(DEFAULT_THANK_YOU_TEXT)}>
                  기본 문구로 되돌리기
                </Button>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="tyName">3. 이름</FieldLabel>
              <Input id="tyName" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>4. 폰트</FieldLabel>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="w-full" style={{ fontFamily }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_FONT}>기본 (명조)</SelectItem>
                    {fonts.map((f) => (
                      <SelectItem key={f.id} value={buildFontStack(f, "--font-kr")} style={fontPreviewStyle(f)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>에셋 관리에 등록한 폰트를 고를 수 있습니다.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="tyTextColor">글자색</FieldLabel>
                <ColorInput id="tyTextColor" value={textColor} onChange={setTextColor} />
              </Field>
            </div>
          </div>

          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <p className="text-xs text-muted-foreground">미리보기 (저장되는 이미지와 같습니다)</p>
            <canvas
              ref={canvasRef}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              className="block w-full max-w-[300px] rounded-md border shadow-sm"
              role="img"
              aria-label="모바일감사장 미리보기"
            />
            {drawError && <p className="text-xs text-destructive">{drawError}</p>}
            <Button type="button" className="w-full max-w-[300px] gap-2" onClick={exportImage} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              이미지로 내보내기
            </Button>
            <p className="text-xs text-muted-foreground">{CARD_WIDTH}×{CARD_HEIGHT}px JPG</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
