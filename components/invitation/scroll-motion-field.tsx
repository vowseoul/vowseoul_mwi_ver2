"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { SCROLL_MOTION_PRESETS, SCROLL_MOTION_INTENSITIES, type ScrollMotionSettings } from "@/lib/scroll-motion"

/**
 * 스크롤 모션(프리셋 + 강도) 선택 UI. 관리자 편집기(customize-client.tsx)와 고객 셀프편집
 * (edit-client.tsx) 양쪽에서 그대로 재사용한다 — 같은 설정을 두 화면에서 다르게 보여주면
 * Consistency 원칙에 어긋난다.
 */
export function ScrollMotionField({
  value,
  onChange,
  idPrefix = "scroll-motion",
}: {
  value: ScrollMotionSettings
  onChange: (next: ScrollMotionSettings) => void
  idPrefix?: string
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <RadioGroup
          value={value.preset}
          onValueChange={(v) => onChange({ ...value, preset: v as ScrollMotionSettings["preset"] })}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {SCROLL_MOTION_PRESETS.map((p) => (
            <label
              key={p.value}
              htmlFor={`${idPrefix}-${p.value}`}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-input p-3 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-accent/40"
            >
              <RadioGroupItem value={p.value} id={`${idPrefix}-${p.value}`} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium leading-none">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.description}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className={`space-y-2 ${value.preset === "none" ? "pointer-events-none opacity-40" : ""}`}>
        <Label className="text-xs text-muted-foreground">강도</Label>
        <RadioGroup
          value={value.intensity}
          onValueChange={(v) => onChange({ ...value, intensity: v as ScrollMotionSettings["intensity"] })}
          className="flex flex-row gap-4"
        >
          {SCROLL_MOTION_INTENSITIES.map((i) => (
            <div key={i.value} className="flex items-center gap-1.5">
              <RadioGroupItem value={i.value} id={`${idPrefix}-intensity-${i.value}`} />
              <Label htmlFor={`${idPrefix}-intensity-${i.value}`} className="cursor-pointer font-normal">
                {i.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <p className="text-[11px] text-muted-foreground">
        기기에서 &quot;동작 줄이기&quot;를 켠 하객에게는 자동으로 모션이 비활성화되고 정적으로 표시됩니다.
      </p>
    </div>
  )
}
