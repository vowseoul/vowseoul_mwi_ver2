/**
 * 축의금 계좌 필드의 공통 규칙.
 *
 * 신랑·신부 본인 계좌는 예금주/은행명/계좌번호가 각각 별도 필드다(account_groom_holder 등).
 * 화면에서만 한 블럭으로 묶어 보여주고 저장은 기존 키 그대로라, 이미 발행된 청첩장과
 * 셀프편집(§lib/self-edit.ts)이 그대로 동작한다.
 *
 * 혼주 계좌(extra_account_groom/bride)는 몇 개가 될지 정해져 있지 않아 값 하나에 배열로
 * 담는다. 폼 인스턴스는 발행 시점에 fields_snapshot 이 고정되므로 extra_account_bride_1,
 * _2 처럼 키를 늘리는 방식으로는 고객마다 다른 개수를 표현할 수 없다 — 식순(timentext)이
 * 이미 같은 이유로 배열을 쓴다.
 */

export interface AccountEntry {
  holder: string
  bank: string
  number: string
}

export const EMPTY_ACCOUNT: AccountEntry = { holder: "", bank: "", number: "" }

/** 신랑·신부 본인 계좌 — 화면에서 한 블럭으로 묶어 보여줄 필드 3종 */
export const ACCOUNT_GROUPS = [
  { prefix: "account_groom", label: "신랑" },
  { prefix: "account_bride", label: "신부" },
] as const

/** 그룹의 대표 필드(이 키를 만나면 블럭 전체를 그리고 나머지 둘은 건너뛴다) */
export const accountGroupKeys = (prefix: string) => ({
  holder: `${prefix}_holder`,
  bank: `${prefix}_bank`,
  number: `${prefix}_number`,
})

/** 어떤 필드 키가 계좌 그룹에 속하는지 → 속하면 그 그룹 prefix */
export function accountGroupOf(fieldKey: string): string | null {
  for (const g of ACCOUNT_GROUPS) {
    const k = accountGroupKeys(g.prefix)
    if (fieldKey === k.holder || fieldKey === k.bank || fieldKey === k.number) return g.prefix
  }
  return null
}

/**
 * 혼주 계좌 필드 — 값이 배열인 필드들.
 *
 * field_type 이 아니라 키로 판정한다. 이 두 키는 이미 청첩장 렌더러와 편집기가 이름으로
 * 직접 참조하는 시스템 키이고(§account-island.tsx, §field-defs.ts), 무엇보다 이미 발행된
 * 폼들의 fields_snapshot(발행 시점에 고정된다)을 건드리지 않고도 새 입력 방식이 적용된다.
 */
export const EXTRA_ACCOUNT_KEYS = ["extra_account_groom", "extra_account_bride"] as const

export const isExtraAccountKey = (fieldKey: string): boolean =>
  (EXTRA_ACCOUNT_KEYS as readonly string[]).includes(fieldKey)

/**
 * 혼주 계좌 값을 배열로 정규화한다.
 * 예전에는 자유 입력 textarea 였으므로 문자열도 들어온다 — 그 경우엔 배열로 바꾸지 않고
 * null 을 돌려주고, 호출부가 원문을 그대로 보여주게 한다(이미 발행된 청첩장 보존).
 */
export function parseAccountList(value: unknown): AccountEntry[] | null {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
      .map((v) => ({
        holder: typeof v.holder === "string" ? v.holder : "",
        bank: typeof v.bank === "string" ? v.bank : "",
        number: typeof v.number === "string" ? v.number : "",
      }))
  }
  if (typeof value === "string" && value.trim()) {
    // 배열이 JSON 문자열로 굳어 들어오는 경로(임시저장 등)도 받아준다
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parseAccountList(parsed)
    } catch {
      /* 자유 입력 텍스트 — 배열이 아니다 */
    }
  }
  return null
}

/** 내용이 하나라도 있는 계좌만 (빈 줄은 저장/표시 대상이 아니다) */
export const isAccountFilled = (a: AccountEntry) =>
  !!(a.holder.trim() || a.bank.trim() || a.number.trim())

/** 하객 화면에 보여줄 한 줄 표기 — "국민은행 123-456 홍길동" */
export function composeAccountText(a: AccountEntry): string {
  return [a.bank, a.number, a.holder].map((s) => s?.trim()).filter(Boolean).join(" ")
}
