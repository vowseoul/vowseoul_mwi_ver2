"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase, logSupabaseError } from "@/lib/supabase"
import { InvitationFrame, type ThemeTemplate, type TokenMap } from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData } from "@/lib/invitation-data"
import { SAMPLE_RAW } from "@/lib/sample-invitation"
import { buildThemeTokens, TOKEN_FIELDS, type ThemeRow } from "@/lib/theme-template"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ExternalLink, Loader2, Save, Sparkles, X } from "lucide-react"
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
  const params = useParams()
  const id = String(params.id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [renderEngine, setRenderEngine] = useState<"legacy" | "template">("template")
  const [html, setHtml] = useState("")
  const [css, setCss] = useState("")
  const [slotManifest, setSlotManifest] = useState<string[]>([])
  const [fieldManifest, setFieldManifest] = useState<string[]>([])
  /** 디자인 토큰 (에셋 설정) — themes.styles 에 '--' 키로 저장 */
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({})
  /** 저장 시 보존해야 하는 기존 styles 의 나머지 키 */
  const [otherStyles, setOtherStyles] = useState<Record<string, unknown>>({})

  // 미리보기에 반영된 값 (적용 버튼으로 갱신 → 키입력마다 iframe 재작성 방지)
  const [applied, setApplied] = useState<{ html: string; css: string; slots: string[] }>({ html: "", css: "", slots: [] })

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

  const save = async () => {
    setSaving(true)
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
      styles: { ...otherStyles, ...cleanTokens },
    }).eq("id", id)
    setSaving(false)
    if (error) {
      toast.error(`저장 실패: ${error.message}`)
    } else {
      toast.success("저장되었습니다.")
    }
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
        </div>

        {/* xl 미만(1단 레이아웃)에서는 실제 스크롤이 main이 아니라 html에서 일어나(admin 레이아웃의
            고질적인 문제) sticky가 기준을 잃으므로 fixed로 뷰포트 하단에 고정하고(사이드바 폭만큼
            lg:left-64 로 비켜준다), xl 이상에서는 원래의(검증된) 컬럼 내부 sticky로 되돌린다. */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-background px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:left-64 lg:px-6 xl:sticky xl:inset-x-auto xl:left-auto xl:z-auto xl:mt-6 xl:px-0 xl:shadow-none">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "저장 중…" : "저장"}
          </Button>
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
        <div className="flex justify-center overflow-x-auto rounded-2xl bg-muted/40 py-5">
          {applied.html
            ? <InvitationFrame template={previewTemplate} data={previewData} tokens={tokens} slots={previewSlots} width={380} height={680} />
            : <div className="p-10 text-sm text-muted-foreground">HTML을 입력하고 &lsquo;미리보기 적용&rsquo;을 누르세요.</div>}
        </div>
      </div>
    </div>
  )
}
