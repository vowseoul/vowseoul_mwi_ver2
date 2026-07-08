"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Save, Globe, Mail, CreditCard, Bell, Shield, Image as ImageIcon, Upload, Loader2, Check } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export default function AdminSettingsPage() {
  const [isSaving, setIsSaving] = useState(false)
  const [isFeatureOpen, setIsFeatureOpen] = useState(true)

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
  }

  const fetchImages = async () => {
    setIsLoadingImages(true)
    const { data, error } = await supabase.storage.from('vow-seoul-storage').list('main-images')
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
        .from('vow-seoul-storage')
        .upload(filePath, file)
      
      if (uploadError) throw uploadError

      const { error: dbError } = await supabase.from('settings').upsert({
        key: 'logo_image',
        value: { path: filePath }
      })

      if (dbError) throw dbError

      setLogoPath(filePath)
      // Force refresh cached logo url in localStorage
      const publicUrl = supabase.storage.from('vow-seoul-storage').getPublicUrl(filePath).data.publicUrl
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

    const { error } = await supabase.storage.from('vow-seoul-storage').upload(filePath, file)
    
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

  const handleSaveHeroContent = async () => {
    setIsSaving(true)
    const { error } = await supabase.from('settings').upsert({
      key: 'hero_content',
      value: heroContent
    })
    setIsSaving(false)
    if (error) {
      toast.error('메인 텍스트 저장에 실패했습니다.')
    } else {
      toast.success('메인 텍스트 설정이 저장되었습니다.')
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    const { error } = await supabase.from('settings').upsert({
      key: 'is_feature_open',
      value: { open: isFeatureOpen }
    })
    setIsSaving(false)
    if (error) {
      toast.error('설정 저장에 실패했습니다.')
    } else {
      toast.success('설정이 성공적으로 저장되었습니다.')
    }
  }

  const currentImageUrl = supabase.storage.from('vow-seoul-storage').getPublicUrl(currentMainImagePath).data.publicUrl


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
          <TabsTrigger value="email">이메일</TabsTrigger>
          <TabsTrigger value="payment">결제</TabsTrigger>
          <TabsTrigger value="notification">알림</TabsTrigger>
          <TabsTrigger value="security">보안</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
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
                        src={supabase.storage.from('vow-seoul-storage').getPublicUrl(logoPath).data.publicUrl} 
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
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
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
                          const url = supabase.storage.from('vow-seoul-storage').getPublicUrl(imgPath).data.publicUrl
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
                <Button onClick={handleSaveHeroContent} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "저장 중..." : "메인 텍스트 저장"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                이메일 설정
              </CardTitle>
              <CardDescription>이메일 발송 설정을 관리합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP 호스트</Label>
                  <Input id="smtpHost" placeholder="smtp.example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP 포트</Label>
                  <Input id="smtpPort" placeholder="587" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP 사용자</Label>
                  <Input id="smtpUser" placeholder="user@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP 비밀번호</Label>
                  <Input id="smtpPassword" type="password" />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senderName">발신자 이름</Label>
                  <Input id="senderName" defaultValue="VOW SEOUL" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderEmail">발신자 이메일</Label>
                  <Input id="senderEmail" defaultValue="no-reply@vowseoul.com" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline">테스트 발송</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                결제 설정
              </CardTitle>
              <CardDescription>결제 게이트웨이 설정을 관리합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="pgProvider">PG사 선택</Label>
                <Select defaultValue="tosspay">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tosspay">토스페이먼츠</SelectItem>
                    <SelectItem value="kakaopay">카카오페이</SelectItem>
                    <SelectItem value="naverpay">네이버페이</SelectItem>
                    <SelectItem value="inicis">KG이니시스</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="merchantId">상점 ID</Label>
                  <Input id="merchantId" placeholder="상점 ID를 입력하세요" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="merchantKey">상점 키</Label>
                  <Input id="merchantKey" type="password" placeholder="상점 키를 입력하세요" />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium">결제 옵션</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">테스트 모드</p>
                    <p className="text-xs text-muted-foreground">실제 결제 대신 테스트 결제를 사용합니다</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">자동 환불</p>
                    <p className="text-xs text-muted-foreground">취소 요청 시 자동으로 환불 처리합니다</p>
                  </div>
                  <Switch />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
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
                알림 설정
              </CardTitle>
              <CardDescription>알림 발송 조건을 설정합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">관리자 알림</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">신규 주문 알림</p>
                    <p className="text-xs text-muted-foreground">새로운 주문이 들어오면 알림을 받습니다</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">문의 알림</p>
                    <p className="text-xs text-muted-foreground">새로운 문의가 등록되면 알림을 받습니다</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">환불 요청 알림</p>
                    <p className="text-xs text-muted-foreground">환불 요청이 들어오면 알림을 받습니다</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium">사용자 알림</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">결제 완료 알림</p>
                    <p className="text-xs text-muted-foreground">결제가 완료되면 사용자에게 알림을 발송합니다</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">마케팅 알림</p>
                    <p className="text-xs text-muted-foreground">프로모션 및 이벤트 알림을 발송합니다</p>
                  </div>
                  <Switch />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">2단계 인증</p>
                    <p className="text-xs text-muted-foreground">관리자 로그인 시 2단계 인증을 사용합니다</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">IP 제한</p>
                    <p className="text-xs text-muted-foreground">특정 IP에서만 관리자 접속을 허용합니다</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">세션 타임아웃</p>
                    <p className="text-xs text-muted-foreground">일정 시간 후 자동 로그아웃</p>
                  </div>
                  <Select defaultValue="60">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30분</SelectItem>
                      <SelectItem value="60">1시간</SelectItem>
                      <SelectItem value="120">2시간</SelectItem>
                      <SelectItem value="480">8시간</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium">비밀번호 변경</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">현재 비밀번호</Label>
                    <Input id="currentPassword" type="password" />
                  </div>
                  <div></div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">새 비밀번호</Label>
                    <Input id="newPassword" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                    <Input id="confirmPassword" type="password" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
