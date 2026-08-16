"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  SCROLL_MOTION_PRESETS,
  SCROLL_MOTION_INTENSITIES,
  DEFAULT_SCROLL_MOTION,
  REVEAL_RATIO_MIN,
  REVEAL_RATIO_MAX,
  type ScrollMotionSettings,
} from "@/lib/scroll-motion"

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
  // revealRatio 는 나중에 추가된 값이라 기존에 저장된 설정에는 없을 수 있다
  const revealPercent = Math.round((value.revealRatio ?? DEFAULT_SCROLL_MOTION.revealRatio) * 100)
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

      <div className={`space-y-2 ${value.preset === "none" ? "pointer-events-none opacity-40" : ""}`}>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">발동 지점</Label>
          <span className="text-xs tabular-nums text-foreground">화면 {revealPercent}% 지점</span>
        </div>
        <Slider
          value={[revealPercent]}
          min={Math.round(REVEAL_RATIO_MIN * 100)}
          max={Math.round(REVEAL_RATIO_MAX * 100)}
          step={5}
          onValueChange={([v]) => onChange({ ...value, revealRatio: v / 100 })}
          aria-label="스크롤 모션 발동 지점"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>늦게 (많이 올라와야 시작)</span>
          <span>일찍 (걸치자마자 시작)</span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        섹션 위쪽 끝이 화면의 이 지점까지 올라오면 모션이 시작됩니다. 값이 클수록 화면 아래에서
        일찍, 작을수록 더 올라온 뒤 늦게 시작합니다.
        기기에서 &quot;동작 줄이기&quot;를 켠 하객에게는 자동으로 모션이 비활성화되고 정적으로 표시됩니다.
      </p>
    </div>
  )
}
