"use client"

import { useDocumentTitle } from "@/lib/use-document-title"

import { useEffect, useMemo, useState } from "react"
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning"
import { useParams } from "next/navigation"
import JSZip from "jszip"
import { supabase, logSupabaseError } from "@/lib/supabase"
import { InvitationFrame, type ThemeTemplate, type TokenMap } from "@/components/invitation/invitation-frame"
import { ScaledPreview } from "@/components/ui/scaled-preview"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData } from "@/lib/invitation-data"
import { SAMPLE_RAW } from "@/lib/sample-invitation"
import { buildThemeTokens, TOKEN_FIELDS, type BlockManifestEntry, type ThemeRow } from "@/lib/theme-template"
import { checkThemeContract } from "@/lib/theme-contract"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { ExternalLink, Loader2, Sparkles, Upload, X } from "lucide-react"
import { toast } from "sonner"

/**
 * 템플릿(B+iframe) 테마 편집기.
 * themes 행의 template_html / template_css / slot_manifest / field_manifest / render_engine 를
 * 편집·저장하고, 우측에서 InvitationFrame 실시간 미리보기를 제공한다.
 * (레거시 스타일 에디터(../page.tsx)와 분리 — 서로 간섭 없음)
 */

const KNOWN_SLOTS = ["bgm", "gallery", "sequence", "calendar", "account", "contact", "map", "rsvp", "guestbook", "share"]

/** HTML 문자열에서 data-field / data-slot 키를 추출 */
function extractMarkers(html: string): { fields: string[]; slots: string[] } {
  if (typeof window === "undefined") return { fields: [], slots: [] }
  const doc = new DOMParser().parseFromString(html, "text/html")
  const uniq = (arr: (string | null)[]) => Array.from(new Set(arr.filter((v): v is string => !!v)))
  return {
    fields: uniq([...doc.querySelectorAll("[data-field]")].map((el) => el.getAttribute("data-field"))),
    slots: uniq([...doc.querySelectorAll("[data-slot]")].map((el) => el.getAttribute("data-slot"))),
  }
}

export default function TemplateThemeEditor() {
  useDocumentTitle("템플릿 편집기")
  const params = useParams()
  const id = String(params.id)

  const [loading, setLoading] = useState(true)

  const [name, setName] = useState("")
  const [renderEngine, setRenderEngine] = useState<"legacy" | "template">("template")
  const [html, setHtml] = useState("")
  const [css, setCss] = useState("")
  const [slotManifest, setSlotManifest] = useState<string[]>([])
  const [fieldManifest, setFieldManifest] = useState<string[]>([])
  /** ZIP 업로드(§handleZipUpload)로만 채워진다 — 이 화면엔 수동 편집 UI가 없다(블럭별
   * 여백/타이틀 편집 가능 여부 선언은 디자이너가 ZIP에 block_manifest.json으로 동봉). */
  const [blockManifest, setBlockManifest] = useState<BlockManifestEntry[]>([])
  const [isImportingZip, setIsImportingZip] = useState(false)
  /** 디자인 토큰 (에셋 설정) — themes.styles 에 '--' 키로 저장 */
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({})
  /** 저장 시 보존해야 하는 기존 styles 의 나머지 키 */
  const [otherStyles, setOtherStyles] = useState<Record<string, unknown>>({})

  // 미리보기에 반영된 값 (적용 버튼으로 갱신 → 키입력마다 iframe 재작성 방지)
  const [applied, setApplied] = useState<{ html: string; css: string; slots: string[] }>({ html: "", css: "", slots: [] })

  // 이탈 경고 — 로드 직후(§아래 useEffect)와 저장 성공 직후 스냅샷을 다시 찍어 비교한다.
  const [initialFingerprint, setInitialFingerprint] = useState<string | null>(null)
  const dirtyFingerprint = JSON.stringify({ name, renderEngine, html, css, slotManifest, fieldManifest, blockManifest, tokenValues, otherStyles })
  const isDirty = initialFingerprint !== null && dirtyFingerprint !== initialFingerprint
  useUnsavedChangesWarning(isDirty)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase.from("themes").select("*").eq("id", id).maybeSingle()
      logSupabaseError("template editor: load theme", error)
      if (!active) return
      if (data) {
        setName(data.name || "")
        setRenderEngine(data.render_engine === "template" ? "template" : "legacy")
        setHtml(data.template_html || "")
        setCss(data.template_css || "")
        setSlotManifest(Array.isArray(data.slot_manifest) ? data.slot_manifest : [])
        setFieldManifest(Array.isArray(data.field_manifest) ? data.field_manifest : [])
        setBlockManifest(Array.isArray(data.block_manifest) ? data.block_manifest as BlockManifestEntry[] : [])

        // 토큰: 레거시 키까지 해석해 초기값을 채우고, styles 의 나머지 키는 보존
        const resolved = buildThemeTokens(data as ThemeRow)
        setTokenValues(resolved)
        const styles = (data.styles && typeof data.styles === "object") ? data.styles as Record<string, unknown> : {}
        const rest: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(styles)) {
          if (!k.startsWith("--")) rest[k] = v
        }
        setOtherStyles(rest)
        setApplied({
          html: data.template_html || "",
          css: data.template_css || "",
          slots: Array.isArray(data.slot_manifest) ? data.slot_manifest : [],
        })
        setInitialFingerprint(JSON.stringify({
          name: data.name || "",
          renderEngine: data.render_engine === "template" ? "template" : "legacy",
          html: data.template_html || "",
          css: data.template_css || "",
          slotManifest: Array.isArray(data.slot_manifest) ? data.slot_manifest : [],
          fieldManifest: Array.isArray(data.field_manifest) ? data.field_manifest : [],
          blockManifest: Array.isArray(data.block_manifest) ? data.block_manifest : [],
          tokenValues: resolved,
          otherStyles: rest,
        }))
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [id])

  const applyPreview = () => setApplied({ html, css, slots: slotManifest })

  const autoExtract = () => {
    const { fields, slots } = extractMarkers(html)
    setFieldManifest(fields)
    // 알려진 슬롯만 매니페스트에 반영
    setSlotManifest(slots.filter((s) => KNOWN_SLOTS.includes(s)))
    toast.success(`추출 완료 · 필드 ${fields.length}개 / 슬롯 ${slots.length}개`)
  }

  /**
   * ZIP 안에서 파일명(경로 무관, 대소문자 무관)으로 항목을 찾는다 — 디자이너가 압축할 때
   * 최상위에 바로 넣든 폴더 하나로 감싸든(scripts/themes/<key>/ 관례처럼) 둘 다 받아준다.
   */
  function findZipEntry(zip: JSZip, basename: string) {
    const target = basename.toLowerCase()
    return Object.values(zip.files).find(
      (f) => !f.dir && f.name.toLowerCase().split("/").pop() === target
    )
  }

  /**
   * 디자이너 ZIP(template.html/template.css + 선택적 slot_manifest.json/field_manifest.json/
   * block_manifest.json)을 업로드하면 붙여넣기 없이 바로 반영한다 — scripts/themes/<key>/의
   * 파일 구성 관례를 그대로 따르므로, 스크립트 경로용으로 이미 준비한 폴더를 압축만 해서
   * 올려도 된다. 매니페스트 JSON이 없으면 기존 "자동 추출" 로직으로 폴백한다.
   */
  const handleZipUpload = async (file: File) => {
    setIsImportingZip(true)
    try {
      const zip = await JSZip.loadAsync(file)

      const htmlEntry = findZipEntry(zip, "template.html")
      const cssEntry = findZipEntry(zip, "template.css")
      if (!htmlEntry || !cssEntry) {
        toast.error("ZIP 안에서 template.html / template.css를 찾지 못했습니다.")
        return
      }

      const newHtml = await htmlEntry.async("string")
      const newCss = await cssEntry.async("string")
      setHtml(newHtml)
      setCss(newCss)

      const slotEntry = findZipEntry(zip, "slot_manifest.json")
      const fieldEntry = findZipEntry(zip, "field_manifest.json")
      const blockEntry = findZipEntry(zip, "block_manifest.json")

      let newSlots: string[]
      let newFields: string[]
      if (slotEntry && fieldEntry) {
        newSlots = JSON.parse(await slotEntry.async("string"))
        newFields = JSON.parse(await fieldEntry.async("string"))
      } else {
        // 매니페스트 JSON이 동봉되지 않았으면 기존 자동 추출로 폴백
        const extracted = extractMarkers(newHtml)
        newFields = extracted.fields
        newSlots = extracted.slots.filter((s) => KNOWN_SLOTS.includes(s))
      }
      setSlotManifest(newSlots)
      setFieldManifest(newFields)

      const newBlocks: BlockManifestEntry[] = blockEntry ? JSON.parse(await blockEntry.async("string")) : []
      setBlockManifest(newBlocks)

      setApplied({ html: newHtml, css: newCss, slots: newSlots })

      const contractErrors = checkThemeContract(newHtml, newSlots, newBlocks)
      if (contractErrors.length > 0) {
        toast.warning(`가져왔지만 계약 검사 ${contractErrors.length}건 위반 — 저장 전에 확인하세요.`, {
          description: contractErrors.slice(0, 3).join("\n") + (contractErrors.length > 3 ? "\n…" : ""),
          duration: 10000,
        })
      } else {
        toast.success(
          `ZIP에서 가져왔습니다 · 필드 ${newFields.length}개 / 슬롯 ${newSlots.length}개 / 블럭 ${newBlocks.length}개 · 계약 검사 통과`
        )
      }
    } catch (err) {
      console.error("ZIP 가져오기 실패:", err)
      toast.error("ZIP 파일을 읽지 못했습니다. 압축이 손상되었거나 형식이 올바르지 않습니다.")
    } finally {
      setIsImportingZip(false)
    }
  }

  const save = async (): Promise<boolean> => {
    // 토큰은 themes.styles 에 '--' 키로 저장 (레거시 키는 그대로 보존)
    const cleanTokens: Record<string, string> = {}
    for (const [k, v] of Object.entries(tokenValues)) {
      if (v) cleanTokens[k] = v
    }

    const { error } = await supabase.from("themes").update({
      name,
      render_engine: renderEngine,
      template_html: html,
      template_css: css,
      slot_manifest: slotManifest,
      field_manifest: fieldManifest,
      block_manifest: blockManifest,
      styles: { ...otherStyles, ...cleanTokens },
    }).eq("id", id)
    if (error) {
      toast.error(`저장 실패: ${error.message}`)
      return false
    }
    setInitialFingerprint(dirtyFingerprint)
    toast.success("저장되었습니다.")
    return true
  }

  const previewTemplate: ThemeTemplate = useMemo(
    () => ({ key: id, name, html: applied.html, css: applied.css, slots: applied.slots }),
    [id, name, applied]
  )
  const previewData = useMemo(() => buildFieldData(SAMPLE_RAW), [])
  // 토큰은 입력 즉시 미리보기에 반영된다 (iframe 재작성 없이 CSS 변수만 갱신)
  const tokens: TokenMap = useMemo(() => {
    const t: TokenMap = {}
    for (const [k, v] of Object.entries(tokenValues)) if (v) t[k] = v
    return t
  }, [tokenValues])
  const previewAccent = tokens["--accent"] || "#D76C6C"
  const previewSlots = useMemo(
    () => buildSlots(applied.slots, { accent: previewAccent, data: previewData, raw: SAMPLE_RAW }),
    [applied.slots, previewData, previewAccent]
  )

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">불러오는 중…</div>
  }

  return (
    // 청첩장 커스터마이즈 화면과 동일한 이유로 position:sticky 대신 뷰포트 기준 고정 높이 +
    // 왼쪽 패널만 자체 스크롤시키는 방식을 쓴다 (admin main의 overflow-auto가 실제 스크롤 컨테이너가
    // 아니라서 sticky가 기준을 잃는 문제). 미리보기 420px 고정폭 때문에 좁은 화면(노트북/태블릿)에서
    // 편집 폭이 찌그러지므로, xl(1280px) 미만에서는 1단으로 쌓는다(미리보기가 위로 오도록 order 지정).
    <div className="grid gap-6 font-sans xl:h-[calc(100vh-100px)] xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* 편집 폼 */}
      <div className="order-2 min-w-0 pb-24 xl:order-1 xl:h-full xl:overflow-y-auto xl:pb-0 xl:pr-1">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">템플릿 테마 편집</h1>
          <p className="text-sm text-muted-foreground mt-1">
            디자이너가 추출한 HTML/CSS를 붙여넣고, 자동 추출로 필드·슬롯을 채운 뒤 저장하세요.
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent>
              <FieldGroup className="space-y-4">
                <Field>
                  <FieldLabel htmlFor="themeName">테마 이름</FieldLabel>
                  <Input id="themeName" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>

                <Field>
                  <FieldLabel>렌더 엔진</FieldLabel>
                  <RadioGroup
                    value={renderEngine}
                    onValueChange={(v) => setRenderEngine(v as "legacy" | "template")}
                    className="flex flex-row gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="template" id="engine-template" />
                      <Label htmlFor="engine-template" className="font-normal cursor-pointer">template (새 iframe 렌더러)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="legacy" id="engine-legacy" />
                      <Label htmlFor="engine-legacy" className="font-normal cursor-pointer">legacy (기존 렌더러)</Label>
                    </div>
                  </RadioGroup>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">ZIP으로 가져오기</CardTitle>
              <CardDescription>
                template.html / template.css (+ 선택적으로 slot_manifest.json / field_manifest.json /
                block_manifest.json)이 담긴 ZIP을 올리면 아래 항목이 자동으로 채워집니다. 매니페스트
                JSON이 없으면 &ldquo;필드·슬롯 자동 추출&rdquo;과 같은 방식으로 HTML에서 뽑아냅니다.
                가져온 뒤에도 저장 전까지는 아래에서 직접 다듬을 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
                {isImportingZip ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                {isImportingZip ? "가져오는 중…" : "ZIP 파일 선택 또는 드래그"}
                <input
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  disabled={isImportingZip}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleZipUpload(file)
                    e.target.value = ""
                  }}
                />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">템플릿 소스</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="space-y-4">
                <Field>
                  <FieldLabel htmlFor="templateHtml">TEMPLATE_HTML</FieldLabel>
                  <Textarea
                    id="templateHtml"
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    spellCheck={false}
                    className="h-48 font-mono text-xs"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="templateCss">TEMPLATE_CSS</FieldLabel>
                  <Textarea
                    id="templateCss"
                    value={css}
                    onChange={(e) => setCss(e.target.value)}
                    spellCheck={false}
                    className="h-48 font-mono text-xs"
                  />
                </Field>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={autoExtract}>
                    <Sparkles className="h-3.5 w-3.5" /> 필드·슬롯 자동 추출
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={applyPreview}>
                    미리보기 적용
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">슬롯 매니페스트 ({slotManifest.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {KNOWN_SLOTS.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <Checkbox
                      id={`slot-${s}`}
                      checked={slotManifest.includes(s)}
                      onCheckedChange={(checked) =>
                        setSlotManifest((cur) => checked ? [...cur, s] : cur.filter((x) => x !== s))
                      }
                    />
                    <Label htmlFor={`slot-${s}`} className="font-normal cursor-pointer">{s}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">디자인 토큰 (에셋 설정)</CardTitle>
              <CardDescription>
                테마 CSS의 <code>var(--토큰, 기본값)</code>을 덮어씁니다. 비워두면 템플릿 원본 색/폰트가 그대로 유지됩니다.
                변경 시 우측 미리보기에 즉시 반영되며, 저장하면 발행 청첩장에도 동일하게 적용됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {TOKEN_FIELDS.map((t) => {
                  const value = tokenValues[t.name] || ""
                  const setValue = (v: string) => setTokenValues((cur) => ({ ...cur, [t.name]: v }))
                  return (
                    <Field key={t.name}>
                      <FieldLabel>{t.label}</FieldLabel>
                      <div className="flex items-center gap-2">
                        {t.type === "color" && (
                          <input
                            type="color"
                            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
                            onChange={(e) => setValue(e.target.value)}
                            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
                          />
                        )}
                        <Input
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={t.type === "color" ? "미지정" : "예: 'Noto Serif KR', serif"}
                          className="flex-1"
                        />
                        {value && (
                          <Button type="button" variant="ghost" size="icon-sm" title="초기화" onClick={() => setValue("")}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </Field>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">필드 매니페스트 ({fieldManifest.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground break-all">
                {fieldManifest.length ? fieldManifest.join(", ") : "— (자동 추출을 실행하세요)"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">블럭 매니페스트 ({blockManifest.length})</CardTitle>
              <CardDescription>
                이 화면에서 직접 편집할 수 없습니다 — ZIP의 block_manifest.json으로만 채워집니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blockManifest.length === 0 ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  — (ZIP에 block_manifest.json이 없으면 비어 있습니다)
                </div>
              ) : (
                <div className="space-y-1.5">
                  {blockManifest.map((b) => (
                    <div key={b.key} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
                      <span className="font-mono font-medium">{b.key}</span>
                      <span className="text-muted-foreground">{b.label}</span>
                      <span className="ml-auto flex gap-1 text-muted-foreground">
                        {b.title && <span className="rounded bg-background px-1.5 py-0.5">title</span>}
                        {b.padding && <span className="rounded bg-background px-1.5 py-0.5">padding</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* xl 미만(1단 레이아웃)에서는 실제 스크롤이 main이 아니라 html에서 일어나(admin 레이아웃의
            고질적인 문제) sticky가 기준을 잃으므로 fixed로 뷰포트 하단에 고정하고(사이드바 폭만큼
            lg:left-64 로 비켜준다), xl 이상에서는 원래의(검증된) 컬럼 내부 sticky로 되돌린다. */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-background px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:left-64 lg:px-6 xl:sticky xl:inset-x-auto xl:left-auto xl:z-auto xl:mt-6 xl:px-0 xl:shadow-none">
          <SaveButton onSave={save} className="gap-2" />
          <Button variant="outline" asChild>
            <a href={`/preview/theme/${id}`} target="_blank" rel="noreferrer" className="gap-2">
              새 탭에서 미리보기 <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* 실시간 미리보기 — xl 이상에서는 왼쪽만 자체 스크롤되어 항상 화면에 고정되고,
          그 아래 좁은 화면에서는 편집 폼 위에 쌓여 보인다(order-1) */}
      <div className="order-1 xl:order-2 xl:h-full xl:overflow-hidden">
        <div className="mb-2.5 text-xs text-muted-foreground">실시간 미리보기</div>
        {/* 좁은 화면(패널 폭이 380px 미만인 태블릿·모바일)에서는 가로 스크롤 대신 비율을 유지한 채 축소한다 */}
        <div className="rounded-2xl bg-muted/40 py-5 px-3">
          {applied.html
            ? (
              <ScaledPreview width={380} height={680}>
                <InvitationFrame template={previewTemplate} data={previewData} tokens={tokens} slots={previewSlots} width={380} height={680} />
              </ScaledPreview>
            )
            : <div className="p-10 text-center text-sm text-muted-foreground">HTML을 입력하고 &lsquo;미리보기 적용&rsquo;을 누르세요.</div>}
        </div>
      </div>
    </div>
  )
}
