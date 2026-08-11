import { GUEST_DATA_PURGE_DAYS } from "./data-retention"
import { PRIVACY_POLICY_VERSION } from "./privacy-policy"

/**
 * 개인정보 수집·이용 동의 문구 — 4개 수집 지점(폼·RSVP·방명록·문의) 공용.
 * 각 문구는 개인정보 보호법 제15조·제22조가 요구하는 4항목(목적·항목·보유기간·거부
 * 시 불이익)을 담는다. 실제 동의 여부는 각 제출 행의 consent_agreed_at/consent_version
 * 컬럼에 기록된다(§supabase/migrations/20260811010000_privacy_consent.sql).
 *
 * CONSENT_VERSION은 방침 버전과 동일하게 맞춘다 — 방침이 바뀌면 "몇 번째 방침에
 * 동의했는지"가 달라져야 하므로 별도 값을 두지 않고 그대로 재사용한다.
 */
export const CONSENT_VERSION = PRIVACY_POLICY_VERSION

export interface ConsentCopy {
  purpose: string
  items: string
  retention: string
  refusalNotice: string
}

export function getFormConsentCopy(retentionDays: number): ConsentCopy {
  return {
    purpose: "청첩장 제작·발행 및 제작 관련 소통",
    items: "성명, 연락처, 예식 정보, 인사말, 사진, 계좌정보",
    retention: `예식일로부터 ${retentionDays}일 후 파기`,
    refusalNotice: "동의를 거부하실 수 있으나, 거부 시 청첩장 제작이 불가능합니다.",
  }
}

export const RSVP_CONSENT_COPY: ConsentCopy = {
  purpose: "예식 참석 인원·식사·셔틀버스 준비",
  items: "성함, 연락처, 참석 정보",
  retention: `예식일로부터 ${GUEST_DATA_PURGE_DAYS}일 후 파기`,
  refusalNotice: "동의를 거부하실 수 있으며, 거부 시 참석 회신 기능을 이용하실 수 없습니다.",
}

export const GUESTBOOK_CONSENT_COPY: ConsentCopy = {
  purpose: "방명록 게시 및 운영",
  items: "이름, 메시지 내용",
  retention: `예식일로부터 ${GUEST_DATA_PURGE_DAYS}일 후 파기`,
  refusalNotice: "동의를 거부하실 수 있으며, 거부 시 방명록을 남기실 수 없습니다.",
}

export const INQUIRY_CONSENT_COPY: ConsentCopy = {
  purpose: "문의 접수 및 답변",
  items: "이름, 이메일, 문의 내용",
  retention: "문의 처리 완료 후 3년간 보관 후 파기",
  refusalNotice: "동의를 거부하실 수 있으나, 거부 시 문의를 접수할 수 없습니다.",
}
