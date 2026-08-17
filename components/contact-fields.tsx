"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { REPEATABLE_ADD_BUTTON_CLASS, REPEATABLE_INPUT_CLASS, REPEATABLE_ROW_CLASS } from "@/components/account-fields"
import { EMPTY_CONTACT, RELATION_OPTIONS, type ContactEntry } from "@/lib/contact-fields"

/** 드롭다운 프리셋에 없는 관계를 직접 적을 때 고르는 항목 */
const CUSTOM_RELATION = "__custom__"

/** 관계 하나(드롭다운 또는 직접입력) + 이름 + 연락처 한 건 */
function ContactBlock({
  value,
  onChange,
  onRemove,
  idPrefix,
}: {
  value: ContactEntry
  onChange: (next: ContactEntry) => void
  onRemove?: () => void
  idPrefix: string
}) {
  // 저장된 관계가 프리셋에 없으면(=예전에 직접 입력한 값) 처음부터 직접입력 모드로 연다
  const [customMode, setCustomMode] = useState(
    () => value.relation !== "" && !(RELATION_OPTIONS as readonly string[]).includes(value.relation)
  )

  return (
    <div className={REPEATABLE_ROW_CLASS}>
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          {customMode ? (
            <div className="flex gap-2">
              <Input
                value={value.relation}
                onChange={(e) => onChange({ ...value, relation: e.target.value })}
                placeholder="관계 입력 (예: 신랑 삼촌)"
                className={REPEATABLE_INPUT_CLASS}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setCustomMode(false); onChange({ ...value, relation: "" }) }}
                className="h-10 shrink-0 px-2.5 text-[11px] text-muted-foreground"
              >
                목록에서 선택
              </Button>
            </div>
          ) : (
            <Select
              value={value.relation || undefined}
              onValueChange={(v) => {
                if (v === CUSTOM_RELATION) { setCustomMode(true); onChange({ ...value, relation: "" }) }
                else onChange({ ...value, relation: v })
              }}
            >
              <SelectTrigger id={`${idPrefix}-relation`} className={REPEATABLE_INPUT_CLASS}>
                <SelectValue placeholder="관계 선택" />
              </SelectTrigger>
              <SelectContent>
                {RELATION_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                <SelectItem value={CUSTOM_RELATION}>직접 입력</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Input
              id={`${idPrefix}-name`}
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="이름"
              className={REPEATABLE_INPUT_CLASS}
            />
            <Input
              id={`${idPrefix}-phone`}
              value={value.phone}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
              placeholder="연락처"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              className={REPEATABLE_INPUT_CLASS}
            />
          </div>
        </div>

        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="이 연락처 삭제"
            title="삭제"
            className="h-10 w-10 shrink-0 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * 추가 연락처 목록 — 신랑·신부 본인 연락처는 고정 필드로 남고, 그 외(혼주 등)는
 * 필요한 만큼 + 로 추가한다. 값은 배열 하나에 담긴다(§lib/contact-fields.ts).
 */
export function ContactListField({
  items,
  onChange,
  idPrefix,
  addLabel = "연락처 추가",
}: {
  items: ContactEntry[]
  onChange: (next: ContactEntry[]) => void
  idPrefix: string
  addLabel?: string
}) {
  const update = (idx: number, next: ContactEntry) =>
    onChange(items.map((it, i) => (i === idx ? next : it)))

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <ContactBlock
          key={idx}
          idPrefix={`${idPrefix}-${idx}`}
          value={item}
          onChange={(next) => update(idx, next)}
          onRemove={() => onChange(items.filter((_, i) => i !== idx))}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...items, { ...EMPTY_CONTACT }])}
        className={REPEATABLE_ADD_BUTTON_CLASS}
      >
        <Plus className="h-4 w-4 text-primary" /> {addLabel}
      </Button>
    </div>
  )
}
