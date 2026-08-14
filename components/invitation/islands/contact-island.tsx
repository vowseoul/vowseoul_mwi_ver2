"use client"

import { Phone, MessageSquare, Instagram } from "lucide-react"
import { isToggledOff } from "@/lib/invitation-data"
import { soft, iconBtnStyle, type SlotProps } from "./shared"


/* ----------------------------- Contact ------------------------------
 * 신랑·신부·혼주 연락처. 폼에서 이미 수집되던 phone_expose·전화번호 필드들이
 * 지금까지 렌더 경로가 없어 아무 데도 표시되지 않았다 — 이 슬롯이 그 값을 받는다.
 * phone_expose 가 '아니오'/false 로 꺼져있으면(미설정은 표시로 간주) 섹션 자체를 숨긴다.
 * ------------------------------------------------------------------ */
/** 폼에 "@" 포함/미포함, 전체 URL 등 여러 형태로 들어올 수 있는 인스타그램 값을 핸들만 남겨 정리한다 */
function normalizeInstagramHandle(raw?: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const afterUrl = trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
  const handle = afterUrl.replace(/^@/, "").replace(/\/$/, "")
  return handle || null
}

function ContactRow({ label, name, phone, instagram, accent }: { label: string; name?: string; phone: string; instagram?: string; accent: string }) {
  const linkStyle = iconBtnStyle(accent, "transparent", accent)
  const handle = normalizeInstagramHandle(instagram)
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${soft(25)}`, gap: 8 }}>
      <div style={{ textAlign: "left", minWidth: 0 }}>
        {name ? (
          <>
            <div style={{ fontSize: 11, opacity: 0.55 }}>{label}</div>
            <div style={{ fontSize: 15.5, fontWeight: 600 }}>{name}</div>
          </>
        ) : (
          <div style={{ fontSize: 15.5, fontWeight: 600 }}>{label}</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <a href={`tel:${phone}`} aria-label="전화 걸기" title="전화" style={{ ...linkStyle, textDecoration: "none" }}><Phone size={16} /></a>
        <a href={`sms:${phone}`} aria-label="문자 보내기" title="문자" style={{ ...linkStyle, textDecoration: "none" }}><MessageSquare size={16} /></a>
        {handle && <a href={`https://instagram.com/${handle}`} target="_blank" rel="noreferrer" aria-label="인스타그램" title="인스타그램" style={{ ...linkStyle, textDecoration: "none" }}><Instagram size={16} /></a>}
      </div>
    </div>
  )
}
function ContactIsland({ accent, data }: SlotProps) {
  if (isToggledOff(data.phone_expose)) return null
  const rows = [
    // 신랑·신부 본인은 전체 스위치가 켜져 있어도 개별로 더 숨길 수 있다(groom_show_phone/bride_show_phone).
    // 혼주(부모) 연락처는 개별 토글이 없어 전체 스위치만 따른다.
    { label: "신랑", name: data.groom_name, phone: isToggledOff(data.groom_show_phone) ? "" : data.groom_phone, instagram: data.groom_sns_instagram },
    { label: "신부", name: data.bride_name, phone: isToggledOff(data.bride_show_phone) ? "" : data.bride_phone, instagram: data.bride_sns_instagram },
    { label: "신랑 아버지", name: data.groom_father_name, phone: data.groom_father_phone },
    { label: "신랑 어머니", name: data.groom_mother_name, phone: data.groom_mother_phone },
    { label: "신부 아버지", name: data.bride_father_name, phone: data.bride_father_phone },
    { label: "신부 어머니", name: data.bride_mother_name, phone: data.bride_mother_phone },
  ].filter((r) => !!r.phone)

  if (rows.length === 0) return null
  return (
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
      {rows.map((r) => (
        <ContactRow key={r.label} label={r.label} name={r.name} phone={r.phone} instagram={r.instagram} accent={accent} />
      ))}
    </div>
  )
}

export { ContactIsland }
