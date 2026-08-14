"use client"

import { Copy, Check, MessageCircle, Send } from "lucide-react"
import { useCopyFeedback } from "@/lib/use-copy-feedback"
import { soft, iconBtnStyle, type SlotProps } from "./shared"

/* ----------------------------- Account ----------------------------- */
function composeAccount(bank?: string, number?: string, holder?: string): string {
  return [bank, number, holder].filter(Boolean).join(" ")
}
function AccountRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  const { isCopied, copy: copyText } = useCopyFeedback()
  const copied = isCopied()
  const numericValue = value.replace(/[^0-9]/g, "")
  const copy = () => copyText(numericValue)
  // 계좌번호만 복사해두고 카카오페이/토스 앱을 열어준다 — 은행마다 다른 공식 송금 API 없이도
  // 이 딥링크들로 앱이 열리므로, 사용자가 그 안에서 붙여넣기만 하면 된다. 계좌번호+금액을
  // 앱에 바로 채워 넣는 방식(예: supertoss://send?bank=..&accountNo=..)은 은행명을 각 앱의
  // 비공식 은행 코드로 정확히 매핑해야 해서 은행별로 조용히 틀린 화면이 열릴 위험이 있다 —
  // "복사 + 앱 열기"가 덜 매끄럽지만 모든 은행에서 항상 정확하게 동작한다.
  // 데스크톱처럼 해당 앱이 없는 환경에서는 딥링크가 그냥 무시되고 복사만 남는다(항상 안전한 폴백).
  const sendViaKakaoPay = () => {
    navigator.clipboard?.writeText(numericValue)
    window.location.href = "kakaotalk://kakaopay/home"
  }
  const sendViaToss = () => {
    navigator.clipboard?.writeText(numericValue)
    window.location.href = "supertoss://send"
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${soft(25)}`, gap: 8 }}>
      <div style={{ textAlign: "left", minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{label}</div>
        <div style={{ fontSize: 13.5 }}>{value}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={sendViaKakaoPay} aria-label="카카오페이로 보내기" title="카카오페이" style={iconBtnStyle(
          "color-mix(in srgb, #FFE300 50%, transparent)", "color-mix(in srgb, #FFE300 16%, transparent)", "#3C1E1E"
        )}>
          <MessageCircle size={16} />
        </button>
        <button onClick={sendViaToss} aria-label="토스로 보내기" title="토스" style={iconBtnStyle(
          "color-mix(in srgb, #0064FF 45%, transparent)", "color-mix(in srgb, #0064FF 14%, transparent)", "#0064FF"
        )}>
          <Send size={16} />
        </button>
        <button onClick={copy} aria-label={copied ? "복사됨" : "계좌번호 복사"} title={copied ? "복사됨" : "계좌번호 복사"} style={{
          ...iconBtnStyle(accent, copied ? accent : "transparent", copied ? "#fff" : accent),
          transition: "background 200ms ease-out, color 200ms ease-out, transform 200ms ease-out",
          transform: copied ? "scale(1.04)" : "scale(1)",
        }}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  )
}
/** 혼주(부모) 계좌 — 은행/번호/예금주를 나눠 받는 본인 계좌와 달리, 부모 쪽은 계좌 수가
 * 정해져 있지 않아(아버지·어머니 각각 또는 한쪽만) 관리자가 자유 형식 텍스트로 입력한다.
 * 숫자만 추출하는 기존 복사 방식은 여러 줄/여러 계좌가 섞인 텍스트에 맞지 않아 원문 그대로 복사한다.
 */
function ExtraAccountRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  const { isCopied, copy: copyText } = useCopyFeedback()
  const copied = isCopied()
  const copy = () => copyText(value)
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${soft(25)}`, gap: 8 }}>
      <div style={{ textAlign: "left", minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13.5, whiteSpace: "pre-line" }}>{value}</div>
      </div>
      <button onClick={copy} aria-label={copied ? "복사됨" : "계좌번호 복사"} title={copied ? "복사됨" : "계좌번호 복사"} style={{
        ...iconBtnStyle(accent, copied ? accent : "transparent", copied ? "#fff" : accent),
        transition: "background 200ms ease-out, color 200ms ease-out, transform 200ms ease-out",
        transform: copied ? "scale(1.04)" : "scale(1)",
      }}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  )
}
function AccountIsland({ accent, data }: SlotProps) {
  const groom = composeAccount(data.account_groom_bank, data.account_groom_number, data.account_groom_holder)
  const bride = composeAccount(data.account_bride_bank, data.account_bride_number, data.account_bride_holder)
  const extraGroom = data.extra_account_groom
  const extraBride = data.extra_account_bride
  const hasAny = groom || bride || extraGroom || extraBride
  return (
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
      {groom && <AccountRow label="신랑측" value={groom} accent={accent} />}
      {bride && <AccountRow label="신부측" value={bride} accent={accent} />}
      {extraGroom && <ExtraAccountRow label="신랑측 혼주" value={extraGroom} accent={accent} />}
      {extraBride && <ExtraAccountRow label="신부측 혼주" value={extraBride} accent={accent} />}
      {!hasAny && <div style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>등록된 계좌 정보가 없습니다.</div>}
    </div>
  )
}
export { AccountIsland }
