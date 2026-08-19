"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Save, Globe, Mail, Bell, Shield, Image as ImageIcon, Upload, Loader2, Check, Users, Trash2, Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { BUCKET_NAME } from "@/lib/storage"
import { createClient } from "@supabase/supabase-js"
import { DATA_RETENTION_SETTINGS_KEY, DEFAULT_RETENTION_DAYS, parseRetentionSettings } from "@/lib/data-retention"
import { SELF_EDIT_SETTINGS_KEY, parseSelfEditSettings } from "@/lib/self-edit"
import {
  TELEGRAM_SETTINGS_KEY, TELEGRAM_KIND_LABELS, parseTelegramSettings,
  type TelegramNotificationSettings,
} from "@/lib/telegram"
import {
  BUSINESS_INFO_SETTINGS_KEY,
  DATA_TRANSFER_SETTINGS_KEY,
  EMPTY_BUSINESS_INFO,
  EMPTY_DATA_TRANSFER_INFO,
  parseBusinessInfo,
  parseDataTransferInfo,
  type BusinessInfo,
  type DataTransferInfo,
} from "@/lib/business-info"
import { useProfilesQuery } from "@/hooks/queries/useCustomers"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import PaperTypesCard from "./paper-types-card"

export default function AdminSettingsPage() {
  const [isFeatureOpen, setIsFeatureOpen] = useState(true)

  const queryClient = useQueryClient()
  const { data: profiles, isLoading: isLoadingProfiles } = useProfilesQuery()
  
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPassword, setStaffPassword] = useState("")
  const [staffName, setStaffName] = useState("")
  const [staffPhone, setStaffPhone] = useState("")
  const [staffRole, setStaffRole] = useState("DESIGNER")
  const [isCreatingStaff, setIsCreatingStaff] = useState(false)

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffEmail.trim() || !staffPassword.trim() || !staffName.trim() || !staffPhone.trim()) {
      toast.error("모든 정보를 올바르게 기입해 주세요.")
      return
    }

    if (staffPassword.length < 6) {
      toast.error("비밀번호는 최소 6글자 이상이어야 합니다.")
      return
    }

    setIsCreatingStaff(true)

    try {
      // 1. Create a non-session-persisting temp client to sign up the user
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
      })

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: staffEmail,
        password: staffPassword,
        options: {
          data: {
            name: staffName,
          }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error("계정 생성 실패")

      // 2. Insert into public.profiles
      const formattedName = `${staffName.trim()} | ${staffPhone.trim()}`
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([{
          id: authData.user.id,
          email: staffEmail.trim(),
          role: staffRole,
          name: formattedName
        }])

      if (profileError) {
        throw profileError
      }

      toast.success("신규 직원 계정이 정상적으로 생성되었습니다.")
      setIsStaffModalOpen(false)
      setStaffEmail("")
      setStaffPassword("")
      setStaffName("")
      setStaffPhone("")
      setStaffRole("DESIGNER")
      
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "직원 계정 생성 중 오류가 발생했습니다.")
    } finally {
      setIsCreatingStaff(false)
    }
  }

  const handleDeleteStaff = async (profileId: string, email: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user && user.email === email) {
      toast.error("현재 로그인된 계정은 삭제할 수 없습니다.")
      return
    }

    if (!(await confirmDialog({ title: "이 직원 계정을 삭제하시겠습니까?", description: "관련 담당자 매핑이 해제될 수 있습니다.", destructive: true, confirmText: "삭제" }))) {
      return
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId)

      if (error) throw error

      toast.success("직원 계정이 정상적으로 삭제되었습니다.")
      queryClient.invalidateQueries({ queryKey: ["profiles"] })
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "직원 계정 삭제에 실패했습니다.")
    }
  }

  const [heroContent, setHeroContent] = useState({
    title: "소중한 서약을 담아드립니다",
    description: "손 쉽게 완성하는 당신만의 특별한 웨딩 초대장.\n우아하고 세련된 모바일 청첩장을 직접 만들어보세요.",
    fontFamily: "font-serif",
    titleFontSize: "text-5xl",
    descFontSize: "text-base",
    layout: "text-center"
  })

  // Homepage image settings state
  const [images, setImages] = useState<any[]>([])
  const [selectedImagePath, setSelectedImagePath] = useState<string>('')
  const [currentMainImagePath, setCurrentMainImagePath] = useState<string>('main-images/image1')
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Custom logo settings state
  const [logoPath, setLogoPath] = useState<string>('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  // 데이터 자동 파기 정책 — 예식일 + 보관일수가 지나면 청첩장을 자동 삭제한다 (§lib/data-retention.ts)
  const [retentionDays, setRetentionDays] = useState<number>(DEFAULT_RETENTION_DAYS)

  // 신랑신부 셀프 편집 기능 on/off (§lib/self-edit.ts)
  const [selfEditEnabled, setSelfEditEnabled] = useState(false)
  const [isSavingSelfEdit, setIsSavingSelfEdit] = useState(false)

  // 텔레그램 알림 종류별 on/off (§lib/telegram.ts) — 발송 시점에 서버가 이 값을 읽는다
  const [telegramSettings, setTelegramSettings] = useState<TelegramNotificationSettings>(
    parseTelegramSettings(null)
  )

  // 로그인한 관리자 본인의 비밀번호 변경
  const [adminEmail, setAdminEmail] = useState("")
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNext, setPwNext] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")

  // 개인정보 처리방침에 채워 넣을 사업자 정보 · CPO · 국외이전 고지 (§lib/business-info.ts)
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(EMPTY_BUSINESS_INFO)
  const [dataTransfer, setDataTransfer] = useState<DataTransferInfo>(EMPTY_DATA_TRANSFER_INFO)

  useEffect(() => {
    fetchCurrentSetting()
    fetchImages()
  }, [])

  const fetchCurrentSetting = async () => {
    const { data: openData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'is_feature_open')
      .single()

    if (openData?.value) {
      setIsFeatureOpen(!!openData.value.open)
    }

    const { data: imgData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'main_image')
      .single()

    if (imgData?.value?.path) {
      setCurrentMainImagePath(imgData.value.path)
      setSelectedImagePath(imgData.value.path)
    }

    const { data: textData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'hero_content')
      .single()

    if (textData?.value) {
      setHeroContent(textData.value)
    }

    const { data: logoData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'logo_image')
      .single()

    if (logoData?.value?.path) {
      setLogoPath(logoData.value.path)
    }

    const { data: retentionData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', DATA_RETENTION_SETTINGS_KEY)
      .maybeSingle()

    setRetentionDays(parseRetentionSettings(retentionData?.value).daysAfterWedding)

    const { data: selfEditData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SELF_EDIT_SETTINGS_KEY)
      .maybeSingle()

    setSelfEditEnabled(parseSelfEditSettings(selfEditData?.value).enabled)

    const { data: businessInfoData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', BUSINESS_INFO_SETTINGS_KEY)
      .maybeSingle()

    setBusinessInfo(parseBusinessInfo(businessInfoData?.value))

    const { data: dataTransferData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', DATA_TRANSFER_SETTINGS_KEY)
      .maybeSingle()

    setDataTransfer(parseDataTransferInfo(dataTransferData?.value))

    const { data: telegramData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', TELEGRAM_SETTINGS_KEY)
      .maybeSingle()

    setTelegramSettings(parseTelegramSettings(telegramData?.value))

    const { data: { user } } = await supabase.auth.getUser()
    setAdminEmail(user?.email ?? "")
  }

  const handleSaveBusinessInfo = async (): Promise<boolean> => {
    const { error } = await supabase.from('settings').upsert({
      key: BUSINESS_INFO_SETTINGS_KEY,
      value: businessInfo,
    })
    if (error) {
      toast.error('사업자 정보 저장에 실패했습니다.')
      return false
    }
    toast.success('사업자 정보가 저장되었습니다.')
    return true
  }

  const handleSaveDataTransfer = async (): Promise<boolean> => {
    const { error } = await supabase.from('settings').upsert({
      key: DATA_TRANSFER_SETTINGS_KEY,
      value: dataTransfer,
    })
    if (error) {
      toast.error('국외이전 정보 저장에 실패했습니다.')
      return false
    }
    toast.success('국외이전 정보가 저장되었습니다.')
    return true
  }

  const handleSaveTelegramSettings = async (): Promise<boolean> => {
    const { error } = await supabase.from('settings').upsert({
      key: TELEGRAM_SETTINGS_KEY,
      value: telegramSettings,
    })
    if (error) {
      toast.error('알림 설정 저장에 실패했습니다.')
      return false
    }
    toast.success('알림 설정이 저장되었습니다.')
    return true
  }

  /**
   * 로그인한 관리자 본인의 비밀번호 변경.
   *
   * Supabase 의 updateUser 는 현재 비밀번호를 묻지 않는다 — 자리를 비운 사이 열려 있는
   * 화면으로 남이 비밀번호를 갈아끼울 수 있다는 뜻이라, 세션을 남기지 않는 임시 클라이언트로
   * 현재 비밀번호를 먼저 확인한다(직원 계정 생성과 같은 방식). 임시 클라이언트를 쓰는 이유는
   * signInWithPassword 가 성공하면서 현재 탭의 세션을 덮어쓰는 것을 막기 위해서다.
   */
  const handleChangeAdminPassword = async (): Promise<boolean> => {
    if (!adminEmail) {
      toast.error('로그인 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.')
      return false
    }
    if (pwNext.length < 6) {
      toast.error('새 비밀번호는 6자 이상이어야 합니다.')
      return false
    }
    if (pwNext !== pwConfirm) {
      toast.error('새 비밀번호와 확인이 일치하지 않습니다.')
      return false
    }
    if (pwNext === pwCurrent) {
      toast.error('현재 비밀번호와 다른 비밀번호를 입력해 주세요.')
      return false
    }

    const tempClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { auth: { persistSession: false } }
    )
    const { error: signInError } = await tempClient.auth.signInWithPassword({
      email: adminEmail,
      password: pwCurrent,
    })
    if (signInError) {
      toast.error('현재 비밀번호가 올바르지 않습니다.')
      return false
    }

    const { error } = await supabase.auth.updateUser({ password: pwNext })
    if (error) {
      toast.error(error.message || '비밀번호 변경에 실패했습니다.')
      return false
    }

    setPwCurrent("")
    setPwNext("")
    setPwConfirm("")
    toast.success('비밀번호가 변경되었습니다.')
    return true
  }

  const handleSaveSelfEdit = async (nextEnabled: boolean) => {
    setSelfEditEnabled(nextEnabled)
    setIsSavingSelfEdit(true)
    const { error } = await supabase.from('settings').upsert({
      key: SELF_EDIT_SETTINGS_KEY,
      value: { enabled: nextEnabled },
    })
    setIsSavingSelfEdit(false)
    if (error) {
      setSelfEditEnabled(!nextEnabled)
      toast.error('셀프 편집 설정 저장에 실패했습니다.')
    } else {
      toast.success(nextEnabled ? '고객 셀프 편집이 활성화되었습니다.' : '고객 셀프 편집이 비활성화되었습니다.')
    }
  }

  const handleSaveRetention = async (): Promise<boolean> => {
    if (!Number.isFinite(retentionDays) || retentionDays < 1) {
      toast.error('보관일수는 1일 이상이어야 합니다.')
      return false
    }
    const { error } = await supabase.from('settings').upsert({
      key: DATA_RETENTION_SETTINGS_KEY,
      value: { daysAfterWedding: Math.floor(retentionDays) },
    })
    if (error) {
      toast.error('데이터 보관 정책 저장에 실패했습니다.')
      return false
    }
    toast.success('데이터 보관 정책이 저장되었습니다.')
    return true
  }

  const fetchImages = async () => {
    setIsLoadingImages(true)
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list('main-images')
    if (data) {
      const validImages = data.filter(file => file.name !== '.emptyFolderPlaceholder' && file.name !== '.DS_Store')
      setImages(validImages)
    }
    setIsLoadingImages(false)
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingLogo(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `logo_${Date.now()}.${fileExt}`
    const filePath = `logo-images/${fileName}`

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file)
      
      if (uploadError) throw uploadError

      const { error: dbError } = await supabase.from('settings').upsert({
        key: 'logo_image',
        value: { path: filePath }
      })

      if (dbError) throw dbError

      setLogoPath(filePath)
      // Force refresh cached logo url in localStorage
      const publicUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath).data.publicUrl
      if (typeof window !== 'undefined' && publicUrl) {
        localStorage.setItem('vow_seoul_custom_logo', publicUrl)
      }

      toast.success('로고가 성공적으로 업로드 및 적용되었습니다.')
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast.error('로고 이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingLogo(false)
      if (event.target) event.target.value = ''
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
    const filePath = `main-images/${fileName}`

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file)
    
    setIsUploading(false)
    if (error) {
      toast.error('이미지 업로드에 실패했습니다.')
    } else {
      toast.success('이미지가 업로드되었습니다.')
      fetchImages()
    }
  }

  const handleSaveMainImage = async () => {
    if (!selectedImagePath) return

    const { error } = await supabase.from('settings').upsert({
      key: 'main_image',
      value: { path: selectedImagePath }
    })

    if (error) {
      toast.error('메인 이미지 설정 저장에 실패했습니다.')
    } else {
      toast.success('메인 이미지가 변경되었습니다.')
      setCurrentMainImagePath(selectedImagePath)
      setIsImageDialogOpen(false)
    }
  }

  const handleSaveHeroContent = async (): Promise<boolean> => {
    const { error } = await supabase.from('settings').upsert({
      key: 'hero_content',
      value: heroContent
    })
    if (error) {
      toast.error('메인 텍스트 저장에 실패했습니다.')
      return false
    }
    toast.success('메인 텍스트 설정이 저장되었습니다.')
    return true
  }

  const handleSave = async (): Promise<boolean> => {
    const { error } = await supabase.from('settings').upsert({
      key: 'is_feature_open',
      value: { open: isFeatureOpen }
    })
    if (error) {
      toast.error('설정 저장에 실패했습니다.')
      return false
    }
    toast.success('설정이 성공적으로 저장되었습니다.')
    return true
  }

  const currentImageUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(currentMainImagePath).data.publicUrl


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">서비스 전체 설정을 관리합니다</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">일반</TabsTrigger>
          <TabsTrigger value="homepage">홈페이지</TabsTrigger>
          <TabsTrigger value="email">고객지원</TabsTrigger>
          <TabsTrigger value="notification">알림</TabsTrigger>
          <TabsTrigger value="security">보안</TabsTrigger>
          <TabsTrigger value="staff">직원 관리</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <PaperTypesCard />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                일반 설정
              </CardTitle>
              <CardDescription>사이트 기본 정보를 설정합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siteName">사이트 이름</Label>
                  <Input id="siteName" defaultValue="VOW SEOUL" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteUrl">사이트 URL</Label>
                  <Input id="siteUrl" defaultValue="https://vowseoul.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteDescription">사이트 설명</Label>
                <Textarea 
                  id="siteDescription" 
                  defaultValue="프리미엄 모바일 청첩장 서비스"
                  rows={3}
                />
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium">로고 설정</h4>
                <p className="text-xs text-muted-foreground">사이트 상단 네비게이션 및 다양한 화면에 표시될 로고 이미지(SVG 권장)를 설정합니다.</p>
                <div className="flex items-center gap-4">
                  <div className="w-40 h-16 border rounded bg-muted/20 flex items-center justify-center overflow-hidden p-2">
                    {logoPath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={supabase.storage.from(BUCKET_NAME).getPublicUrl(logoPath).data.publicUrl}
                        alt="Logo Preview" 
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">기본 로고 사용 중</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" className="relative cursor-pointer overflow-hidden" disabled={isUploadingLogo}>
                      {isUploadingLogo ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 업로드 중...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> 로고 업로드</>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                      />
                    </Button>
                    {logoPath && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive text-xs hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          const { error } = await supabase.from('settings').delete().eq('key', 'logo_image')
                          if (!error) {
                            setLogoPath('')
                            if (typeof window !== 'undefined') {
                              localStorage.removeItem('vow_seoul_custom_logo')
                            }
                            toast.success('기본 로고로 설정이 초기화되었습니다.')
                          }
                        }}
                      >
                        기본 로고로 초기화
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium">서비스 상태</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">기능 오픈</p>
                    <p className="text-xs text-muted-foreground">이 기능을 끄면 청첩장 제작 등 일반 기능 접속 시 준비중 페이지로 이동합니다</p>
                  </div>
                  <Switch checked={isFeatureOpen} onCheckedChange={setIsFeatureOpen} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">점검 모드</p>
                    <p className="text-xs text-muted-foreground">점검 중에는 사용자가 서비스에 접근할 수 없습니다</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">신규 가입 허용</p>
                    <p className="text-xs text-muted-foreground">새로운 회원 가입을 허용합니다</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              <div className="flex justify-end">
                <SaveButton onSave={handleSave} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                고객 셀프 편집
              </CardTitle>
              <CardDescription>
                신랑신부가 관리자 대시보드를 거치지 않고 이름·연락처·인사말·계좌·갤러리 사진을
                직접 수정할 수 있게 합니다. 디자인(색상·폰트)과 테마, 블록 순서는 이 기능으로
                수정할 수 없습니다 — 항상 관리자 편집기에서만 변경됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">셀프 편집 허용</p>
                  <p className="text-xs text-muted-foreground">
                    끄면 신랑신부 대시보드에서 편집 화면 진입 버튼이 사라지고, 편집 링크로 직접
                    접속해도 안내 화면만 표시됩니다.
                  </p>
                </div>
                <Switch checked={selfEditEnabled} onCheckedChange={handleSaveSelfEdit} disabled={isSavingSelfEdit} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Homepage Settings */}
        <TabsContent value="homepage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                메인 이미지 설정
              </CardTitle>
              <CardDescription>시작 페이지(홈)의 배경 이미지를 관리합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="overflow-hidden rounded-lg border bg-muted/30 p-2 relative w-full max-w-xl aspect-[2/1] flex items-center justify-center">
                {currentImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    key={currentImageUrl}
                    src={currentImageUrl} 
                    alt="Current Main Image" 
                    className="w-full h-full object-cover rounded-md"
                  />
                ) : (
                  <span className="text-muted-foreground">이미지가 없습니다</span>
                )}
              </div>

              <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    이미지 변경하기
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>메인 이미지 갤러리</DialogTitle>
                    <p className="text-sm text-muted-foreground">목록에서 이미지를 선택하거나 새 이미지를 업로드하세요.</p>
                  </DialogHeader>

                  <div className="flex justify-end my-2">
                    <Button variant="outline" className="relative cursor-pointer overflow-hidden">
                      {isUploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 업로드 중...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> 새 이미지 업로드</>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 min-h-[300px]">
                    {isLoadingImages ? (
                      <div className="flex justify-center items-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : images.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {images.map((img) => {
                          const imgPath = `main-images/${img.name}`
                          const url = supabase.storage.from(BUCKET_NAME).getPublicUrl(imgPath).data.publicUrl
                          const isSelected = selectedImagePath === imgPath

                          return (
                            <div 
                              key={img.name}
                              onClick={() => setSelectedImagePath(imgPath)}
                              className={`relative aspect-[4/3] rounded-md overflow-hidden cursor-pointer border-2 transition-all ${isSelected ? 'border-primary shadow-md' : 'border-transparent hover:border-muted-foreground/30'}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={img.name} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <div className="bg-primary text-primary-foreground rounded-full p-1">
                                    <Check className="w-5 h-5" />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        업로드된 이미지가 없습니다.
                      </div>
                    )}
                  </div>

                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setIsImageDialogOpen(false)}>취소</Button>
                    <Button onClick={handleSaveMainImage} disabled={!selectedImagePath}>
                      선택한 이미지 저장
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                메인 텍스트 설정
              </CardTitle>
              <CardDescription>시작 페이지(홈)의 메인 텍스트와 폰트, 레이아웃을 관리합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="heroTitle">메인 타이틀</Label>
                  <Input 
                    id="heroTitle" 
                    value={heroContent.title}
                    onChange={(e) => setHeroContent({...heroContent, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroDesc">서브 텍스트 (설명)</Label>
                  <Textarea 
                    id="heroDesc" 
                    rows={3}
                    value={heroContent.description}
                    onChange={(e) => setHeroContent({...heroContent, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>폰트 종류</Label>
                    <Select 
                      value={heroContent.fontFamily} 
                      onValueChange={(val) => setHeroContent({...heroContent, fontFamily: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="폰트 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="font-serif">Serif (명조체/바탕체)</SelectItem>
                        <SelectItem value="font-sans">Sans-serif (고딕체/돋움체)</SelectItem>
                        <SelectItem value="font-mono">Monospace (고정폭)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>정렬 방식</Label>
                    <Select 
                      value={heroContent.layout} 
                      onValueChange={(val) => setHeroContent({...heroContent, layout: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="레이아웃 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text-left">좌측 정렬</SelectItem>
                        <SelectItem value="text-center">중앙 정렬</SelectItem>
                        <SelectItem value="text-right">우측 정렬</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>타이틀 크기</Label>
                    <Select 
                      value={heroContent.titleFontSize} 
                      onValueChange={(val) => setHeroContent({...heroContent, titleFontSize: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="타이틀 폰트 크기" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text-3xl">작게 (3xl)</SelectItem>
                        <SelectItem value="text-4xl">중간 (4xl)</SelectItem>
                        <SelectItem value="text-5xl">크게 (5xl)</SelectItem>
                        <SelectItem value="text-6xl">아주 크게 (6xl)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>서브 텍스트 크기</Label>
                    <Select 
                      value={heroContent.descFontSize} 
                      onValueChange={(val) => setHeroContent({...heroContent, descFontSize: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="서브 폰트 크기" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text-sm">작게 (sm)</SelectItem>
                        <SelectItem value="text-base">기본 (base)</SelectItem>
                        <SelectItem value="text-lg">크게 (lg)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <SaveButton onSave={handleSaveHeroContent} idleLabel="메인 텍스트 저장" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Support Settings */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                고객지원센터 정보
              </CardTitle>
              <CardDescription>
                문의하기(/contact) 페이지에 그대로 표시되는 고객지원센터 정보입니다. 실제 값을 입력해 주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supportEmail2">이메일</Label>
                  <Input
                    id="supportEmail2"
                    type="email"
                    value={businessInfo.supportEmail}
                    onChange={(e) => setBusinessInfo((p) => ({ ...p, supportEmail: e.target.value }))}
                    placeholder="support@vowseoul.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportPhone2">전화번호</Label>
                  <Input
                    id="supportPhone2"
                    value={businessInfo.supportPhone}
                    onChange={(e) => setBusinessInfo((p) => ({ ...p, supportPhone: e.target.value }))}
                    placeholder="02-123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportHours">운영시간</Label>
                  <Input
                    id="supportHours"
                    value={businessInfo.supportHours}
                    onChange={(e) => setBusinessInfo((p) => ({ ...p, supportHours: e.target.value }))}
                    placeholder="평일 10:00 - 17:00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportAddress">오시는 길 (주소)</Label>
                  <Input
                    id="supportAddress"
                    value={businessInfo.address}
                    onChange={(e) => setBusinessInfo((p) => ({ ...p, address: e.target.value }))}
                    placeholder="서울특별시 강남구 테헤란로 123"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <SaveButton onSave={handleSaveBusinessInfo} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Notification Settings */}
        <TabsContent value="notification">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                텔레그램 알림
              </CardTitle>
              <CardDescription>
                고객이 무언가를 제출하면 관리자 텔레그램으로 즉시 알립니다. 관리자 대시보드의 벨 알림을 보완하는 용도입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {TELEGRAM_KIND_LABELS.map(({ kind, label, description }) => (
                  <div key={kind} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={telegramSettings[kind]}
                      onCheckedChange={(checked) => setTelegramSettings((p) => ({ ...p, [kind]: checked }))}
                      aria-label={label}
                    />
                  </div>
                ))}
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                크론(자동 파기 등) 실패 알림은 시스템 경보라 끌 수 없습니다.
                봇 토큰·채팅 ID가 서버에 설정되지 않은 경우에는 위 설정과 무관하게 아무 알림도 발송되지 않습니다.
              </p>
              <div className="flex justify-end">
                <SaveButton onSave={handleSaveTelegramSettings} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                보안 설정
              </CardTitle>
              <CardDescription>보안 관련 설정을 관리합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">내 비밀번호 변경</h4>
                <p className="text-xs text-muted-foreground">
                  지금 로그인한 관리자 계정({adminEmail || "…"})의 비밀번호를 바꿉니다.
                  다른 직원의 비밀번호는 여기서 바꿀 수 없습니다.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">현재 비밀번호</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                    />
                  </div>
                  <div></div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">새 비밀번호</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={pwNext}
                      onChange={(e) => setPwNext(e.target.value)}
                      placeholder="6자 이상"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <SaveButton
                  onSave={handleChangeAdminPassword}
                  idleLabel="비밀번호 변경"
                  pendingLabel="변경 중…"
                  successLabel="변경됨"
                  disabled={!pwCurrent || !pwNext || !pwConfirm}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                사업자 정보 및 개인정보 보호책임자
              </CardTitle>
              <CardDescription>
                개인정보 처리방침(/privacy)에 그대로 표시되는 정보입니다. 실제 값을 입력해 주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">사업자 정보</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">상호명</Label>
                    <Input
                      id="businessName"
                      value={businessInfo.businessName}
                      onChange={(e) => setBusinessInfo((p) => ({ ...p, businessName: e.target.value }))}
                      placeholder="예: 주식회사 보우서울"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="representativeName">대표자명</Label>
                    <Input
                      id="representativeName"
                      value={businessInfo.representativeName}
                      onChange={(e) => setBusinessInfo((p) => ({ ...p, representativeName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">사업자등록번호</Label>
                    <Input
                      id="registrationNumber"
                      value={businessInfo.registrationNumber}
                      onChange={(e) => setBusinessInfo((p) => ({ ...p, registrationNumber: e.target.value }))}
                      placeholder="000-00-00000"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  고객센터 이메일·전화번호·주소는 설정 &gt; 고객지원 탭에서 입력합니다.
                </p>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium">개인정보 보호책임자(CPO)</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cpoName">성명</Label>
                    <Input
                      id="cpoName"
                      value={businessInfo.cpoName}
                      onChange={(e) => setBusinessInfo((p) => ({ ...p, cpoName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpoTitle">직책</Label>
                    <Input
                      id="cpoTitle"
                      value={businessInfo.cpoTitle}
                      onChange={(e) => setBusinessInfo((p) => ({ ...p, cpoTitle: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpoPhone">연락처</Label>
                    <Input
                      id="cpoPhone"
                      value={businessInfo.cpoPhone}
                      onChange={(e) => setBusinessInfo((p) => ({ ...p, cpoPhone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpoEmail">이메일</Label>
                    <Input
                      id="cpoEmail"
                      type="email"
                      value={businessInfo.cpoEmail}
                      onChange={(e) => setBusinessInfo((p) => ({ ...p, cpoEmail: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <SaveButton onSave={handleSaveBusinessInfo} />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                데이터 보관 정책
              </CardTitle>
              <CardDescription>
                예식일로부터 지정한 일수가 지나면 청첩장이 자동으로 삭제(소프트 삭제)됩니다.
                청첩장 목록에서 &quot;SAMPLE&quot;로 지정한 청첩장은 예식일과 무관하게 항상 제외됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">예식일 기준 보관일수</p>
                  <p className="text-xs text-muted-foreground">
                    변경하면 기존 청첩장에도 즉시 적용됩니다 (매일 자동 실행되는 파기 작업이 이 값을 그때그때 읽습니다).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">일 후</span>
                </div>
              </div>
              <div className="flex justify-end">
                <SaveButton onSave={handleSaveRetention} />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                국외이전 정보
              </CardTitle>
              <CardDescription>
                Supabase(DB·Storage)·Vercel(호스팅·Analytics) 리전이 국외면 개인정보 처리방침에
                국외이전 고지가 포함되어야 합니다. 각 서비스 대시보드의 Project Settings &gt; Region에서
                확인할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">국외이전 고지 포함</p>
                  <p className="text-xs text-muted-foreground">
                    리전이 국내(서울)뿐이면 꺼두어도 됩니다.
                  </p>
                </div>
                <Switch
                  checked={dataTransfer.isOverseas}
                  onCheckedChange={(checked) => setDataTransfer((p) => ({ ...p, isOverseas: checked }))}
                />
              </div>
              {dataTransfer.isOverseas && (
                <div className="space-y-2">
                  <Label htmlFor="transferDetails">국외이전 상세 내용</Label>
                  <Textarea
                    id="transferDetails"
                    rows={4}
                    value={dataTransfer.details}
                    onChange={(e) => setDataTransfer((p) => ({ ...p, details: e.target.value }))}
                    placeholder={"이전받는 자 - Supabase Inc. / 이전국가 - 미국 / 이전 항목 - 저장된 전체 데이터\n이전 목적 - 데이터베이스·파일 저장 / 보유·이용기간 - 서비스 이용기간 동안"}
                  />
                  <p className="text-xs text-muted-foreground">
                    이전받는 자, 이전국가, 이전 항목, 이전 목적, 보유·이용기간을 포함해 작성해 주세요.
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <SaveButton onSave={handleSaveDataTransfer} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Management Settings */}
        <TabsContent value="staff">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center bg-muted/10 border-b border-border py-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Users className="w-5 h-5 text-primary" />
                  직원 계정 관리
                </CardTitle>
                <CardDescription className="text-xs">
                  서비스를 함께 운영할 디자이너 및 운영진 계정을 생성하고 연락처를 지정합니다.
                </CardDescription>
              </div>
              <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 h-8">
                    <Plus className="w-3.5 h-3.5" /> 직원 등록
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md font-sans text-xs">
                  <DialogHeader>
                    <DialogTitle className="text-base font-semibold">신규 직원 계정 생성</DialogTitle>
                    <DialogDescription className="text-xs">
                      새로운 운영진이나 디자이너 계정을 생성하고 프로필을 등록합니다.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateStaff} className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label htmlFor="staffName">이름 *</Label>
                      <Input
                        id="staffName"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="이름 입력"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="staffPhone">연락처 *</Label>
                      <Input
                        id="staffPhone"
                        value={staffPhone}
                        onChange={(e) => setStaffPhone(e.target.value)}
                        placeholder="예: 010-1234-5678"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="staffEmail">로그인용 이메일 *</Label>
                      <Input
                        id="staffEmail"
                        type="email"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="staff@vowseoul.com"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="staffPassword">임시 비밀번호 *</Label>
                      <Input
                        id="staffPassword"
                        type="password"
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        placeholder="6자리 이상"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="staffRole">권한 역할 *</Label>
                      <Select value={staffRole} onValueChange={setStaffRole}>
                        <SelectTrigger className="h-8 text-xs bg-muted/10">
                          <SelectValue placeholder="역할 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DESIGNER">디자이너 (DESIGNER)</SelectItem>
                          <SelectItem value="ADMIN">운영자 (ADMIN)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter className="pt-4 border-t border-border">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsStaffModalOpen(false)} disabled={isCreatingStaff}>
                        취소
                      </Button>
                      <Button type="submit" size="sm" disabled={isCreatingStaff} className="gap-2">
                        {isCreatingStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        생성 및 등록
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingProfiles ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                  직원 목록을 불러오는 중입니다...
                </div>
              ) : profiles?.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  등록된 직원 계정이 없습니다.
                </div>
              ) : (
                <>
                  {/* 모바일 카드 리스트 — sm 미만에서는 5열 테이블 대신 카드로 보여준다 */}
                  <div className="sm:hidden divide-y divide-border">
                    {profiles?.map((profile: any) => {
                      const [namePart, phonePart] = (profile.name || "").split("|").map((s: string) => s.trim())
                      return (
                        <div key={profile.id} className="flex items-start justify-between gap-3 p-3.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{namePart || "이름 없음"}</span>
                              <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${profile.role === 'ADMIN' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300'}`}>
                                {profile.role === 'ADMIN' ? '운영자' : '디자이너'}
                              </span>
                            </div>
                            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{profile.email}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{phonePart || "-"}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                            aria-label="삭제"
                            onClick={() => handleDeleteStaff(profile.id, profile.email)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>

                  {/* 데스크톱/태블릿 테이블 — sm 이상에서만 보인다 */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-muted-foreground font-medium">
                          <th className="p-3.5">이름</th>
                          <th className="p-3.5">연락처</th>
                          <th className="p-3.5">이메일</th>
                          <th className="p-3.5">권한</th>
                          <th className="p-3.5 text-right w-16">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profiles?.map((profile: any) => {
                          const [namePart, phonePart] = (profile.name || "").split("|").map((s: string) => s.trim())
                          return (
                            <tr key={profile.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                              <td className="p-3.5 font-medium">{namePart || "이름 없음"}</td>
                              <td className="p-3.5 text-muted-foreground">{phonePart || "-"}</td>
                              <td className="p-3.5 font-mono">{profile.email}</td>
                              <td className="p-3.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${profile.role === 'ADMIN' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300'}`}>
                                  {profile.role === 'ADMIN' ? '운영자' : '디자이너'}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  aria-label="삭제"
                                  onClick={() => handleDeleteStaff(profile.id, profile.email)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
