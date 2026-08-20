"use client"

import { useRef } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { GripVertical, Image as ImageIcon, Loader2, Plus, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parseFontAxes } from "@/lib/font-axes"
import type { RegisteredFont } from "@/lib/fonts"
import type { FieldDef } from "./field-defs"

/**
 * customize-client.tsx의 프레젠테이션 전용 하위 컴포넌트 모음(상태 없음, props만
 * 받아 렌더). 원래 편집기 컴포넌트 파일 맨 아래 380줄 정도를 차지하고 있어 본체
 * 로직을 찾기 어려웠다 — 로직 변경 없이 그대로 옮긴 것뿐이다.
 */

/** 블럭 아코디언 한 행을 드래그 정렬 가능하게 감싼다. render-prop으로 드래그 손잡이(attributes/listeners)를
 * 넘겨줘서 호출부가 원하는 위치(트리거 왼쪽)에 손잡이 아이콘을 꽂을 수 있게 한다. */
export function SortableBlockRow({ id, children }: {
  id: string
  children: (drag: Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: "relative", zIndex: isDragging ? 1 : "auto" }}
    >
      {children({ attributes, listeners })}
    </div>
  )
}

export function DragHandle({ attributes, listeners }: Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      aria-label="드래그해서 순서 변경"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}

/** 사이즈 토큰 슬라이더 — 색 토큰 UI와 동일한 "미설정=테마 기본값, 값 있으면 되돌리기 버튼" 규칙을 따른다 */
export function SizeSliderField({ label, value, defaultValue, min, max, onChange, onReset }: {
  label: string
  value: number | undefined
  defaultValue: number
  min: number
  max: number
  onChange: (v: number) => void
  onReset: () => void
}) {
  const isSet = value != null
  const current = value ?? defaultValue
  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className={cn("text-xs tabular-nums", isSet ? "text-foreground" : "text-muted-foreground")}>
          {current}px{!isSet && " · 기본값"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Slider value={[current]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} className="flex-1" />
        {isSet && (
          <Button type="button" variant="ghost" size="icon-sm" title="테마 기본값으로" onClick={onReset}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Field>
  )
}

/** 블럭 오버라이드용 색상 필드 — "색상" 카드의 테마 토큰 피커와 동일한 모양(스와치+hex+되돌리기)을 따른다 */
export function BlockColorField({ label, value, defaultValue, onChange, onReset }: {
  label: string
  value: string | undefined
  defaultValue: string
  onChange: (v: string) => void
  onReset: () => void
}) {
  const displayValue = value || defaultValue
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-start gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(displayValue) ? displayValue : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
        />
        <Input value={displayValue} onChange={(e) => onChange(e.target.value)} placeholder="기본값" className="min-w-0 flex-1" />
        {value && (
          <Button type="button" variant="ghost" size="icon-sm" title="기본값으로" onClick={onReset}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Field>
  )
}

export function TextField({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={def.key}>{def.label}</FieldLabel>
      {def.type === "textarea" ? (
        <Textarea id={def.key} value={value} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : (
        <Input id={def.key} type={def.type === "tel" ? "tel" : "text"} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  )
}

export function ImageField({ def, value, uploading, onUpload, onClear }: {
  def: FieldDef; value: string; uploading: boolean; onUpload: (file: File) => void; onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Field>
      <FieldLabel>{def.label}</FieldLabel>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {uploading ? "업로드 중…" : "이미지 선택"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-auto px-1 py-0 text-xs text-muted-foreground">
              제거
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = "" }}
      />
    </Field>
  )
}

export function GalleryUploadButton({ uploading, onSelect }: { uploading: boolean; onSelect: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="gap-1.5"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {uploading ? "업로드 중…" : "이미지 추가"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={uploading}
        onChange={(e) => { if (e.target.files?.length) onSelect(e.target.files); e.target.value = "" }}
      />
    </div>
  )
}

/**
 * 선택한 폰트가 실제로 싣고 있는 변형(굵기 · 이탤릭)만 고르게 한다.
 *
 * 없는 변형을 고르게 두면 브라우저가 가짜 볼드/기울임으로 대충 그려서, 고른 대로
 * 안 나오는데 원인은 화면에 안 보인다. 그래서 축이 없는 폰트(예: Aboreto)나 파일
 * 업로드 폰트에서는 이 컨트롤 자체를 그리지 않는다 — 효과 없는 컨트롤은 버그로 읽힌다.
 *
 * 굵기는 문자열로 저장한다. 숫자로 넣으면 extractOverrideTokens 가 단위를 붙여
 * `700px` 이 되고 font-weight 가 통째로 무시된다(§lib/theme-template.ts).
 */
export function FontVariantFields({ tokenName, font, overrides, setOverride, clearOverride }: {
  tokenName: string
  font: RegisteredFont | undefined
  overrides: Record<string, unknown>
  setOverride: (name: string, value: string) => void
  clearOverride: (name: string) => void
}) {
  const axes = parseFontAxes(font?.embedCode)
  const hasWeights = axes.weights.length > 1
  if (!font || (!hasWeights && !axes.italic)) return null

  const weightToken = `${tokenName}-weight`
  const styleToken = `${tokenName}-style`
  const weight = typeof overrides[weightToken] === "string" ? (overrides[weightToken] as string) : ""
  const isItalic = overrides[styleToken] === "italic"

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2">
      <span className="text-xs text-muted-foreground">{font.name} 변형</span>
      {hasWeights && (
        <Select value={weight} onValueChange={(v) => setOverride(weightToken, v)}>
          <SelectTrigger size="sm" className="w-[128px]">
            <SelectValue placeholder="굵기 (기본)" />
          </SelectTrigger>
          <SelectContent>
            {axes.weights.map((w) => (
              <SelectItem key={w} value={String(w)} style={{ fontFamily: `'${font.family}', sans-serif`, fontWeight: w }}>
                {w}{WEIGHT_LABEL[w] ? ` · ${WEIGHT_LABEL[w]}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {axes.italic && (
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <Checkbox
            checked={isItalic}
            onCheckedChange={(c) => (c ? setOverride(styleToken, "italic") : clearOverride(styleToken))}
          />
          <span style={{ fontFamily: `'${font.family}', sans-serif`, fontStyle: "italic" }}>Italic</span>
        </label>
      )}
      {(weight || isItalic) && (
        <Button
          type="button" variant="ghost" size="icon-sm" title="폰트 기본 변형으로"
          onClick={() => { clearOverride(weightToken); clearOverride(styleToken) }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

const WEIGHT_LABEL: Record<number, string> = {
  100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
  500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black",
}
