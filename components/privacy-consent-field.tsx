'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown } from 'lucide-react'
import type { ConsentCopy } from '@/lib/privacy-consent'

/**
 * shadcn 환경(관리자·폼·문의) 전용 개인정보 수집·이용 동의 필드.
 * 하객 아일랜드(iframe 내부, inline style)는 별도 컴포넌트를 쓴다
 * — §components/invitation/consent-notice.tsx, THEME_TOKEN_GUIDE 계약상
 * iframe 안에서는 Tailwind/shadcn 클래스가 적용되지 않는다.
 *
 * 기본은 접힌 상태로 마찰을 줄이고, 체크박스 라벨에는 항상 "(필수)"를 노출한다.
 */
export function PrivacyConsentField({
  copy,
  checked,
  onCheckedChange,
}: {
  copy: ConsentCopy
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <div className="flex items-start gap-2">
        <Checkbox
          id="privacy-consent"
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <label htmlFor="privacy-consent" className="flex-1 cursor-pointer select-none font-medium">
          (필수) 개인정보 수집·이용 동의
        </label>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label="상세 내용 보기"
          className="text-muted-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">목적</span> {copy.purpose}
          </p>
          <p>
            <span className="font-medium text-foreground">항목</span> {copy.items}
          </p>
          <p>
            <span className="font-medium text-foreground">보유</span> {copy.retention}
          </p>
          <p className="pt-1">{copy.refusalNotice}</p>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="inline-block pt-1 underline underline-offset-2">
            개인정보처리방침 전문 보기 →
          </a>
        </div>
      )}
    </div>
  )
}
