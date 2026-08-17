"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EMPTY_ACCOUNT, type AccountEntry } from "@/lib/account-fields"

/**
 * 계좌 한 건 입력 블럭 — 예금주/은행명은 한 줄에 나란히, 계좌번호는 그 아래 전체 폭.
 * 셋을 세로로 쌓으면 계좌 하나에 세 줄씩 잡아먹어 폼이 길어지고, 누구의 어떤 정보인지
 * 한눈에 안 들어온다.
 */
export function AccountBlock({
  value,
  onChange,
  onRemove,
  invalid,
  idPrefix,
}: {
  value: AccountEntry
  onChange: (next: AccountEntry) => void
  onRemove?: () => void
  invalid?: boolean
  idPrefix: string
}) {
  const set = (key: keyof AccountEntry) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value })

  return (
    <div
      className={`relative rounded-xl border-2 p-3 ${invalid ? "border-destructive" : "border-foreground/80"}`}
    >
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="이 계좌 삭제"
          className="absolute -top-3 -right-2 h-7 w-7 rounded-full border bg-background text-destructive shadow-sm hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-holder`} className="text-xs text-muted-foreground">예금주</label>
          <Input id={`${idPrefix}-holder`} value={value.holder} onChange={set("holder")} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-bank`} className="text-xs text-muted-foreground">은행명</label>
          <Input id={`${idPrefix}-bank`} value={value.bank} onChange={set("bank")} />
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <label htmlFor={`${idPrefix}-number`} className="text-xs text-muted-foreground">계좌번호</label>
        <Input
          id={`${idPrefix}-number`}
          value={value.number}
          onChange={set("number")}
          inputMode="numeric"
          placeholder="- 없이 입력해도 됩니다"
        />
      </div>
    </div>
  )
}

/**
 * 관리자 편집기용 혼주 계좌 입력. 예전 자유 입력(문자열)으로 저장된 청첩장은 원문을
 * 그대로 두고 고칠 수만 있게 하고, 원할 때 계좌별 입력으로 넘어가게 한다 — 문자열을
 * 임의로 쪼개면 계좌를 잘못 나눌 수 있다.
 *
 * `list` 가 null 이면 배열 값이 없는 상태다(= 예전 문자열을 쓰는 중).
 */
export function ExtraAccountEditor({
  label,
  legacyText,
  list,
  onChangeList,
  onChangeLegacy,
}: {
  label: string
  legacyText: string
  list: AccountEntry[] | null
  onChangeList: (next: AccountEntry[] | null) => void
  onChangeLegacy: (next: string) => void
}) {
  if (list === null && legacyText.trim()) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <Textarea value={legacyText} onChange={(e) => onChangeLegacy(e.target.value)} rows={3} />
        <p className="text-[11px] text-muted-foreground">
          예전 방식(자유 입력)으로 저장된 내용입니다. 계좌별로 나누면 하객 화면에서 계좌번호만
          정확히 복사됩니다.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChangeList([{ ...EMPTY_ACCOUNT }])}>
          계좌별로 나눠 입력하기
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <AccountListField
        idPrefix={label}
        items={list ?? []}
        onChange={onChangeList}
        addLabel="혼주 계좌 추가"
      />
    </div>
  )
}

/**
 * 혼주 계좌 목록 — 필요할 때만 + 로 추가하고 삭제할 수 있다.
 * 값은 배열 하나에 담기므로 개수 제한이 없다(§lib/account-fields.ts).
 */
export function AccountListField({
  items,
  onChange,
  idPrefix,
  addLabel = "계좌 추가",
}: {
  items: AccountEntry[]
  onChange: (next: AccountEntry[]) => void
  idPrefix: string
  addLabel?: string
}) {
  const update = (idx: number, next: AccountEntry) =>
    onChange(items.map((it, i) => (i === idx ? next : it)))

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <AccountBlock
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
        onClick={() => onChange([...items, { ...EMPTY_ACCOUNT }])}
        className="w-full gap-1.5 border-dashed text-muted-foreground"
      >
        <Plus className="h-4 w-4" /> {addLabel}
      </Button>
    </div>
  )
}
