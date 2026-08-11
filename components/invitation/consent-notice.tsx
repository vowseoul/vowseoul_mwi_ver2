"use client"

import { useState } from "react"
import type { ConsentCopy } from "@/lib/privacy-consent"

/**
 * 하객 아일랜드(RSVP·방명록) 전용 개인정보 수집·이용 동의 UI.
 *
 * 이 컴포넌트는 React portal로 테마 iframe의 Document에 마운트된다(§invitation-frame.tsx
 * FramePortal). iframe 안에는 이 앱의 Tailwind 빌드가 실려 있지 않으므로 className 이
 * 아니라 inline style만 써야 한다 — RsvpIsland/GuestbookIsland의 기존 규약과 동일.
 * 글자 크기는 12px 미만을 쓰지 않는다(고지문 판독성 — 시행령 제17조 취지).
 */
export function ConsentNotice({
  copy,
  checked,
  onChange,
  accent,
}: {
  copy: ConsentCopy
  checked: boolean
  onChange: (checked: boolean) => void
  accent: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 14, background: "#f9fafb" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <input
          id="consent-notice-checkbox"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginTop: 2, width: 16, height: 16, accentColor: accent, flexShrink: 0, cursor: "pointer" }}
        />
        <label
          htmlFor="consent-notice-checkbox"
          style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}
        >
          (필수) 개인정보 수집·이용 동의
        </label>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label="상세 내용 보기"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", padding: 0 }}
        >
          {expanded ? "숨기기 ▲" : "자세히 ▼"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb", fontSize: 12, lineHeight: 1.6, color: "#6b7280" }}>
          <p style={{ margin: "2px 0" }}>
            <strong style={{ color: "#374151" }}>목적</strong> {copy.purpose}
          </p>
          <p style={{ margin: "2px 0" }}>
            <strong style={{ color: "#374151" }}>항목</strong> {copy.items}
          </p>
          <p style={{ margin: "2px 0" }}>
            <strong style={{ color: "#374151" }}>보유</strong> {copy.retention}
          </p>
          <p style={{ margin: "6px 0 0" }}>{copy.refusalNotice}</p>
          <a
            href="/privacy"
            target="_top"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: 6, color: "#6b7280", textDecoration: "underline" }}
          >
            개인정보처리방침 전문 보기 →
          </a>
        </div>
      )}
    </div>
  )
}
