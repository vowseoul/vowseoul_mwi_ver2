/**
 * 개인정보 처리방침에 표시할 사업자 정보 · 개인정보 보호책임자(CPO) · 국외이전 고지.
 * settings 테이블(key='business_info' / 'data_transfer_info')에 저장되며 관리자
 * 설정 > 보안 탭에서 직접 입력한다. app/privacy/page.tsx가 이 값을 읽어 방침
 * 본문에 채워 넣는다 — 코드에 실제 사업자 정보를 하드코딩하지 않기 위함이다.
 */

export const BUSINESS_INFO_SETTINGS_KEY = "business_info"

export interface BusinessInfo {
  businessName: string
  representativeName: string
  registrationNumber: string
  address: string
  supportEmail: string
  supportPhone: string
  cpoName: string
  cpoTitle: string
  cpoPhone: string
  cpoEmail: string
}

export const EMPTY_BUSINESS_INFO: BusinessInfo = {
  businessName: "",
  representativeName: "",
  registrationNumber: "",
  address: "",
  supportEmail: "",
  supportPhone: "",
  cpoName: "",
  cpoTitle: "",
  cpoPhone: "",
  cpoEmail: "",
}

export function parseBusinessInfo(value: unknown): BusinessInfo {
  if (!value || typeof value !== "object") return { ...EMPTY_BUSINESS_INFO }
  const v = value as Record<string, unknown>
  const pick = (key: keyof BusinessInfo) => (typeof v[key] === "string" ? (v[key] as string) : "")
  return {
    businessName: pick("businessName"),
    representativeName: pick("representativeName"),
    registrationNumber: pick("registrationNumber"),
    address: pick("address"),
    supportEmail: pick("supportEmail"),
    supportPhone: pick("supportPhone"),
    cpoName: pick("cpoName"),
    cpoTitle: pick("cpoTitle"),
    cpoPhone: pick("cpoPhone"),
    cpoEmail: pick("cpoEmail"),
  }
}

/** 방침 페이지에 실제 값이 하나도 없을 때 "TODO" 표시로 되돌리기 위한 판정 */
export function isBusinessInfoIncomplete(info: BusinessInfo): boolean {
  return Object.values(info).some((v) => !v.trim())
}

export const DATA_TRANSFER_SETTINGS_KEY = "data_transfer_info"

export interface DataTransferInfo {
  /** Supabase/Vercel 등 인프라 리전이 국외라 개인정보 국외이전 고지가 필요한가 */
  isOverseas: boolean
  /** 이전받는 자 · 이전국가 · 이전항목 · 이전목적 · 보유기간을 관리자가 자유 서술 */
  details: string
}

export const EMPTY_DATA_TRANSFER_INFO: DataTransferInfo = { isOverseas: false, details: "" }

export function parseDataTransferInfo(value: unknown): DataTransferInfo {
  if (!value || typeof value !== "object") return { ...EMPTY_DATA_TRANSFER_INFO }
  const v = value as Record<string, unknown>
  return {
    isOverseas: v.isOverseas === true,
    details: typeof v.details === "string" ? v.details : "",
  }
}
