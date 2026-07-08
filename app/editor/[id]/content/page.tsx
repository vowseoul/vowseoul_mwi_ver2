'use client'

import { useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore, samplePhrases } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, Upload, GripVertical, Plus, Trash2, FileText, Loader2, Pencil, Image } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadFile } from '@/lib/storage'

export default function ContentPage() {
  const router = useRouter()
  const params = useParams()
  const { currentInvitation, updateCurrentInvitation, saveInvitation, setActiveSection } = useAppStore()
  const invitationId = params.id as string
  const [showMessageModal, setShowMessageModal] = useState(false)
  
  const [isUploadingMain, setIsUploadingMain] = useState(false)
  const [isUploadingGallery, setIsUploadingGallery] = useState(false)
  const [isUploadingSubway, setIsUploadingSubway] = useState(false)
  const [isUploadingParking, setIsUploadingParking] = useState(false)
  const [isUploadingGroom, setIsUploadingGroom] = useState(false)
  const [isUploadingBride, setIsUploadingBride] = useState(false)

  const subwayImageInputRef = useRef<HTMLInputElement>(null)
  const parkingImageInputRef = useRef<HTMLInputElement>(null)
  const groomImageInputRef = useRef<HTMLInputElement>(null)
  const brideImageInputRef = useRef<HTMLInputElement>(null)

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, role: 'groom' | 'bride') => {
    if (!e.target.files || e.target.files.length === 0) return
    const isGroom = role === 'groom'
    if (isGroom) setIsUploadingGroom(true)
    else setIsUploadingBride(true)
    
    try {
      const url = await uploadFile(e.target.files[0], 'profiles')
      const newStyles = {
        ...(currentInvitation?.customStyles || {}),
        [isGroom ? 'groomImage' : 'brideImage']: url
      }
      updateCurrentInvitation({ customStyles: newStyles })
    } catch (err) {
      alert('프로필 사진 업로드에 실패했습니다.')
    } finally {
      if (isGroom) setIsUploadingGroom(false)
      else setIsUploadingBride(false)
      if (e.target) e.target.value = ''
    }
  }

  const updateCustomStyle = (key: string, value: any) => {
    const customStyles = {
      ...(currentInvitation?.customStyles || {}),
      [key]: value
    }
    updateCurrentInvitation({ customStyles })
  }

  const handleTransportImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'subway' | 'parking') => {
    if (!e.target.files || e.target.files.length === 0) return
    const isSub = type === 'subway'
    if (isSub) setIsUploadingSubway(true)
    else setIsUploadingParking(true)
    
    try {
      const url = await uploadFile(e.target.files[0], 'transport')
      const newStyles = {
        ...(currentInvitation?.customStyles || {}),
        [isSub ? 'subwayImage' : 'parkingImage']: url,
        [isSub ? 'subwayDisplayType' : 'parkingDisplayType']: currentInvitation?.customStyles?.[isSub ? 'subwayDisplayType' : 'parkingDisplayType'] || 'popup',
        [isSub ? 'subwayButtonText' : 'parkingButtonText']: currentInvitation?.customStyles?.[isSub ? 'subwayButtonText' : 'parkingButtonText'] || '이미지 보기'
      }
      updateCurrentInvitation({ customStyles: newStyles })
    } catch (err) {
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      if (isSub) setIsUploadingSubway(false)
      else setIsUploadingParking(false)
      if (e.target) e.target.value = ''
    }
  }
  
  // Bank Account Dialog State
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [newAccount, setNewAccount] = useState({
    bank: '',
    accountNumber: '',
    accountHolder: '',
    relation: 'groom' as 'groom' | 'bride' | 'groomParent' | 'brideParent'
  })

  // Contact Dialog State
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relation: 'groom'
  })

  const handleAddAccount = () => {
    if (!newAccount.bank || !newAccount.accountNumber || !newAccount.accountHolder) {
      alert('모든 계좌 정보를 입력해주세요.')
      return
    }
    const currentAccounts = currentInvitation?.bankAccounts || []
    let updatedAccounts
    if (editingAccountId) {
      updatedAccounts = currentAccounts.map(acc => 
        acc.id === editingAccountId ? { ...acc, ...newAccount } : acc
      )
      setEditingAccountId(null)
    } else {
      updatedAccounts = [
        ...currentAccounts,
        {
          id: 'acc-' + Math.random().toString(36).substring(2, 9),
          ...newAccount
        }
      ]
    }
    updateCurrentInvitation({ bankAccounts: updatedAccounts })
    setIsAccountDialogOpen(false)
    setNewAccount({
      bank: '',
      accountNumber: '',
      accountHolder: '',
      relation: 'groom'
    })
  }

  const handleAddContact = () => {
    if (!newContact.name || !newContact.phone || !newContact.relation) {
      alert('모든 연락처 정보를 입력해주세요.')
      return
    }
    const currentContacts = currentInvitation?.contacts || []
    let updatedContacts
    if (editingContactId) {
      updatedContacts = currentContacts.map(con => 
        con.id === editingContactId ? { ...con, ...newContact } : con
      )
      setEditingContactId(null)
    } else {
      updatedContacts = [
        ...currentContacts,
        {
          id: 'con-' + Math.random().toString(36).substring(2, 9),
          ...newContact
        }
      ]
    }
    updateCurrentInvitation({ contacts: updatedContacts })
    setIsContactDialogOpen(false)
    setNewContact({
      name: '',
      phone: '',
      relation: 'groom'
    })
  }
  
  const mainImageInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingMain(true)
    try {
      const url = await uploadFile(e.target.files[0], 'main-images')
      updateCurrentInvitation({ mainImage: url })
    } catch (err) {
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingMain(false)
      // Reset input
      if (e.target) e.target.value = ''
    }
  }

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingGallery(true)
    try {
      const urls = []
      for (const file of Array.from(e.target.files)) {
        const url = await uploadFile(file, 'gallery')
        urls.push(url)
      }
      const currentImages = currentInvitation?.galleryImages || []
      updateCurrentInvitation({ galleryImages: [...currentImages, ...urls] })
    } catch (err) {
      alert('갤러리 업로드에 실패했습니다.')
    } finally {
      setIsUploadingGallery(false)
      // Reset input
      if (e.target) e.target.value = ''
    }
  }

  const handleNext = async () => {
    const savedId = await saveInvitation()
    const targetId = savedId || invitationId
    router.push(`/editor/${targetId}/features`)
  }

  const handleBack = () => {
    router.push(`/editor/${invitationId}/design`)
  }

  const handleSelectMessage = (message: string) => {
    updateCurrentInvitation({ invitationMessage: message })
    setShowMessageModal(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">콘텐츠</h1>
        <p className="mt-1 text-muted-foreground">
          청첩장에 들어갈 내용을 입력해주세요.
        </p>
      </div>

      <Accordion type="multiple" defaultValue={['main-visual', 'message', 'gallery', 'directions']} className="space-y-4">
        {/* Main Visual */}
        <AccordionItem value="main-visual" className="rounded-lg border border-border">
          <AccordionTrigger className="px-4 hover:no-underline">
            <span className="font-medium">메인 비주얼</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <div className="flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50">
                {currentInvitation?.mainImage ? (
                  <div className="relative h-full w-full">
                    <img 
                      src={currentInvitation.mainImage} 
                      alt="메인 비주얼" 
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={() => updateCurrentInvitation({ mainImage: null })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center" onClick={() => mainImageInputRef.current?.click()} style={{ cursor: 'pointer' }}>
                    {isUploadingMain ? (
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isUploadingMain ? '업로드 중...' : '이미지를 드래그하거나 클릭하여 업로드'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={mainImageInputRef}
                  onChange={handleMainImageUpload}
                  disabled={isUploadingMain}
                />
                <Button variant="outline" className="flex-1" onClick={() => { setActiveSection('hero'); mainImageInputRef.current?.click() }} disabled={isUploadingMain}>
                  {isUploadingMain ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  이미지 업로드
                </Button>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">대문 이름 연결 기호 (&amp;)</p>
                    <p className="text-xs text-muted-foreground">신랑과 신부 이름 사이의 연결 기호를 지정합니다.</p>
                  </div>
                  <Select
                    value={currentInvitation?.customStyles?.heroConnector || '&'}
                    onValueChange={(val) => {
                      const customStyles = {
                        ...(currentInvitation?.customStyles || {}),
                        heroConnector: val
                      }
                      updateCurrentInvitation({ customStyles })
                      setActiveSection('hero')
                    }}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="&">&amp; (엠퍼샌드)</SelectItem>
                      <SelectItem value="♥">♥ (하트)</SelectItem>
                      <SelectItem value="and">and (소문자)</SelectItem>
                      <SelectItem value="AND">AND (대문자)</SelectItem>
                      <SelectItem value="with">with</SelectItem>
                      <SelectItem value="none">없음 (기호 제외)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Invitation Message */}
        <AccordionItem value="message" className="rounded-lg border border-border">
          <AccordionTrigger className="px-4 hover:no-underline">
            <span className="font-medium">초대말</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <FieldGroup>
              <Field>
                <Textarea
                  placeholder="초대의 말씀을 작성해주세요..."
                  rows={5}
                  value={currentInvitation?.invitationMessage || ''}
                  onChange={(e) => updateCurrentInvitation({ invitationMessage: e.target.value })}
                  onFocus={() => setActiveSection('greeting')}
                />
                <FieldDescription>
                  청첩장에 표시될 인사말을 작성해주세요.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-4">
                  <FileText className="mr-2 h-4 w-4" />
                  샘플 문구 보기
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle>샘플 문구</DialogTitle>
                  <DialogDescription>
                    원하는 문구를 선택하시면 자동으로 입력됩니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-3">
                  {samplePhrases.map((phrase) => (
                    <button
                      key={phrase.id}
                      onClick={() => handleSelectMessage(phrase.text)}
                      className="w-full rounded-lg border border-border p-4 text-left text-sm leading-relaxed transition-colors hover:bg-muted"
                    >
                      <div className="mb-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {phrase.category === 'classic' ? '클래식' : 
                           phrase.category === 'modern' ? '모던' : 
                           phrase.category === 'romantic' ? '로맨틱' : '심플'}
                        </Badge>
                      </div>
                      <p className="whitespace-pre-line">{phrase.text}</p>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {/* Pink Envelope profile images uploader */}
            <div className="mt-6 border-t border-border pt-6">
              <h4 className="text-sm font-medium mb-1 flex items-center gap-1.5">
                <Image className="w-4 h-4 text-muted-foreground" />
                <span>Pink Envelope 테마 전용 사진</span>
              </h4>
              <p className="text-xs text-muted-foreground mb-4">Pink Envelope 테마를 사용할 경우 표시되는 신랑, 신부 프로필 사진을 등록해 주세요.</p>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Groom profile image */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block text-center">신랑 프로필 사진</span>
                  <div 
                    className="aspect-square w-full rounded-md border border-dashed border-border bg-muted/40 hover:bg-muted/60 transition-colors flex flex-col items-center justify-center cursor-pointer overflow-hidden relative"
                    onClick={() => groomImageInputRef.current?.click()}
                  >
                    {currentInvitation?.customStyles?.groomImage ? (
                      <>
                        <img 
                          src={currentInvitation.customStyles.groomImage} 
                          alt="Groom Profile Uploaded" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Pencil className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : isUploadingGroom ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground text-xs gap-1">
                        <Upload className="w-4 h-4" />
                        <span>사진 올리기</span>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={groomImageInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleProfileImageUpload(e, 'groom')} 
                  />
                  {currentInvitation?.customStyles?.groomImage && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs text-destructive h-7"
                      onClick={() => updateCustomStyle('groomImage', null)}
                    >
                      사진 삭제
                    </Button>
                  )}
                </div>

                {/* Bride profile image */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block text-center">신부 프로필 사진</span>
                  <div 
                    className="aspect-square w-full rounded-md border border-dashed border-border bg-muted/40 hover:bg-muted/60 transition-colors flex flex-col items-center justify-center cursor-pointer overflow-hidden relative"
                    onClick={() => brideImageInputRef.current?.click()}
                  >
                    {currentInvitation?.customStyles?.brideImage ? (
                      <>
                        <img 
                          src={currentInvitation.customStyles.brideImage} 
                          alt="Bride Profile Uploaded" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Pencil className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : isUploadingBride ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground text-xs gap-1">
                        <Upload className="w-4 h-4" />
                        <span>사진 올리기</span>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={brideImageInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleProfileImageUpload(e, 'bride')} 
                  />
                  {currentInvitation?.customStyles?.brideImage && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs text-destructive h-7"
                      onClick={() => updateCustomStyle('brideImage', null)}
                    >
                      사진 삭제
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Gallery */}
        <AccordionItem value="gallery" className="rounded-lg border border-border">
          <AccordionTrigger className="px-4 hover:no-underline">
            <span className="font-medium">갤러리</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <FieldGroup>
              <Field>
                <FieldLabel>뷰 타입</FieldLabel>
                <RadioGroup
                  value={currentInvitation?.galleryViewType || 'slide'}
                  onValueChange={(value: 'grid' | 'slide') => updateCurrentInvitation({ galleryViewType: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="slide" id="slide" />
                    <Label htmlFor="slide">슬라이드</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="grid" id="grid" />
                    <Label htmlFor="grid">그리드</Label>
                  </div>
                </RadioGroup>
              </Field>
              {currentInvitation?.galleryViewType === 'slide' && (
                <Field>
                  <FieldLabel>사진 정렬 방식</FieldLabel>
                  <RadioGroup
                    value={currentInvitation?.customStyles?.galleryAlign || 'center'}
                    onValueChange={(value: 'center' | 'bottom') => updateCustomStyle('galleryAlign', value)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="center" id="align-center" />
                      <Label htmlFor="align-center">중앙 정렬</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="bottom" id="align-bottom" />
                      <Label htmlFor="align-bottom">하단 정렬</Label>
                    </div>
                  </RadioGroup>
                </Field>
              )}
              <Field>
                <FieldLabel>사진 업로드</FieldLabel>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {(currentInvitation?.galleryImages || []).map((image, index) => (
                    <div key={index} className="group relative aspect-square">
                      <img 
                        src={image} 
                        alt={`갤러리 ${index + 1}`}
                        className="h-full w-full rounded-lg object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white">
                          <GripVertical className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-white"
                          onClick={() => {
                            const newImages = [...(currentInvitation?.galleryImages || [])]
                            newImages.splice(index, 1)
                            updateCurrentInvitation({ galleryImages: newImages })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    ref={galleryInputRef}
                    onChange={handleGalleryUpload}
                    disabled={isUploadingGallery}
                  />
                  <button 
                    className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 transition-colors hover:bg-muted disabled:opacity-50"
                    onClick={() => { setActiveSection('gallery'); galleryInputRef.current?.click() }}
                    disabled={isUploadingGallery}
                  >
                    {isUploadingGallery ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <FieldDescription>
                  드래그하여 순서를 변경할 수 있습니다.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>

        {/* Sequence/Timeline */}
        <AccordionItem value="sequence" className="rounded-lg border border-border">
          <AccordionTrigger className="px-4 hover:no-underline" onClick={() => setActiveSection('sequence')}>
            <span className="font-medium">식순 안내</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">식순 안내 기능 사용</p>
                  <p className="text-xs text-muted-foreground">청첩장에 식순 타임라인을 표시합니다.</p>
                </div>
                <Switch
                  checked={currentInvitation?.customStyles?.sequenceEnabled || false}
                  onCheckedChange={(checked) => {
                    updateCustomStyle('sequenceEnabled', checked)
                    setActiveSection('sequence')
                  }}
                />
              </div>

              {currentInvitation?.customStyles?.sequenceEnabled && (
                <div className="mt-4 space-y-4 rounded-lg bg-muted/50 p-4 border border-border">
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="seq-title">대제목</FieldLabel>
                      <Input
                        id="seq-title"
                        placeholder="식순 안내"
                        value={currentInvitation?.customStyles?.sequenceTitle || ''}
                        onChange={(e) => updateCustomStyle('sequenceTitle', e.target.value)}
                        onFocus={() => setActiveSection('sequence')}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="seq-subtitle">소제목 (영문)</FieldLabel>
                      <Input
                        id="seq-subtitle"
                        placeholder="WEDDING ORDER"
                        value={currentInvitation?.customStyles?.sequenceSubtitle || ''}
                        onChange={(e) => updateCustomStyle('sequenceSubtitle', e.target.value)}
                        onFocus={() => setActiveSection('sequence')}
                      />
                    </Field>
                  </div>

                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">식순 목록</p>
                    
                    <div className="space-y-2">
                      {((currentInvitation?.customStyles?.sequenceEvents) || [
                        { id: '1', time: '12:00', title: '식전 영상 상영' },
                        { id: '2', time: '12:10', title: '개식 및 화촉점화' },
                        { id: '3', time: '12:20', title: '신랑 신부 입장' },
                        { id: '4', time: '12:30', title: '혼인서약 및 성혼선언' },
                        { id: '5', time: '12:45', title: '축가 및 하객 인사' },
                        { id: '6', time: '13:00', title: '신랑 신부 행진 및 폐식' }
                      ]).map((event: any, index: number) => {
                        const eventTime = event.time || '12:00';
                        const [hour, minute] = eventTime.split(':');
                        const eventsList = (currentInvitation?.customStyles?.sequenceEvents) || [
                          { id: '1', time: '12:00', title: '식전 영상 상영' },
                          { id: '2', time: '12:10', title: '개식 및 화촉점화' },
                          { id: '3', time: '12:20', title: '신랑 신부 입장' },
                          { id: '4', time: '12:30', title: '혼인서약 및 성혼선언' },
                          { id: '5', time: '12:45', title: '축가 및 하객 인사' },
                          { id: '6', time: '13:00', title: '신랑 신부 행진 및 폐식' }
                        ];

                        const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
                        const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

                        return (
                          <div key={event.id || index} className="flex items-center gap-2 bg-background p-2 rounded border border-border">
                            {/* Time Selectors */}
                            <div className="flex items-center gap-1">
                              <Select
                                value={hour}
                                onValueChange={(newHour) => {
                                  const newTime = `${newHour}:${minute}`;
                                  const updated = eventsList.map((ev: any) => ev.id === event.id ? { ...ev, time: newTime } : ev);
                                  updateCustomStyle('sequenceEvents', updated);
                                }}
                              >
                                <SelectTrigger className="w-[60px] h-8 text-xs px-1.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {hours.map(h => (
                                    <SelectItem key={h} value={h}>{h}시</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <span className="text-xs text-muted-foreground">:</span>

                              <Select
                                value={minute}
                                onValueChange={(newMinute) => {
                                  const newTime = `${hour}:${newMinute}`;
                                  const updated = eventsList.map((ev: any) => ev.id === event.id ? { ...ev, time: newTime } : ev);
                                  updateCustomStyle('sequenceEvents', updated);
                                }}
                              >
                                <SelectTrigger className="w-[60px] h-8 text-xs px-1.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {minutes.map(m => (
                                    <SelectItem key={m} value={m}>{m}분</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Title Input */}
                            <Input
                              placeholder="식순 내용을 입력하세요"
                              value={event.title || ''}
                              className="h-8 text-xs flex-1"
                              onChange={(e) => {
                                const updated = eventsList.map((ev: any) => ev.id === event.id ? { ...ev, title: e.target.value } : ev);
                                updateCustomStyle('sequenceEvents', updated);
                              }}
                              onFocus={() => setActiveSection('sequence')}
                            />

                            {/* Delete Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                const updated = eventsList.filter((ev: any) => ev.id !== event.id);
                                updateCustomStyle('sequenceEvents', updated);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 h-8 text-xs"
                      onClick={() => {
                        const eventsList = (currentInvitation?.customStyles?.sequenceEvents) || [
                          { id: '1', time: '12:00', title: '식전 영상 상영' },
                          { id: '2', time: '12:10', title: '개식 및 화촉점화' },
                          { id: '3', time: '12:20', title: '신랑 신부 입장' },
                          { id: '4', time: '12:30', title: '혼인서약 및 성혼선언' },
                          { id: '5', time: '12:45', title: '축가 및 하객 인사' },
                          { id: '6', time: '13:00', title: '신랑 신부 행진 및 폐식' }
                        ];
                        const newEvent = {
                          id: `seq_${Date.now()}`,
                          time: '12:00',
                          title: ''
                        };
                        updateCustomStyle('sequenceEvents', [...eventsList, newEvent]);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      식순 추가
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Directions */}
        <AccordionItem value="directions" className="rounded-lg border border-border">
          <AccordionTrigger className="px-4 hover:no-underline">
            <span className="font-medium">오시는 길</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="address">주소</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="address"
                    placeholder="주소를 검색해주세요"
                    value={currentInvitation?.venueAddress || ''}
                    onChange={(e) => updateCurrentInvitation({ venueAddress: e.target.value })}
                    onFocus={() => setActiveSection('location')}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline"
                    type="button"
                    onClick={() => {
                      const executePostcode = () => {
                        new (window as any).daum.Postcode({
                          oncomplete: (data: any) => {
                            let fullAddress = data.address;
                            let extraAddress = '';

                            if (data.addressType === 'R') {
                              if (data.bname !== '') {
                                extraAddress += data.bname;
                              }
                              if (data.buildingName !== '') {
                                extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
                              }
                              fullAddress += extraAddress !== '' ? ` (${extraAddress})` : '';
                            }

                            updateCurrentInvitation({ venueAddress: fullAddress });
                          },
                        }).open();
                      };

                      if (!(window as any).daum) {
                        const script = document.createElement('script');
                        script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
                        script.onload = executePostcode;
                        document.body.appendChild(script);
                      } else {
                        executePostcode();
                      }
                    }}
                  >
                    주소 검색
                  </Button>
                </div>
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  네이버 지도 연동
                </Button>
                <Button variant="outline" className="flex-1">
                  카카오 지도 연동
                </Button>
              </div>
              <Field>
                <FieldLabel htmlFor="trafficInfo">교통 안내</FieldLabel>
                <Textarea
                  id="trafficInfo"
                  placeholder="대중교통 이용 방법을 안내해주세요"
                  rows={3}
                  value={currentInvitation?.trafficInfo || ''}
                  onChange={(e) => updateCurrentInvitation({ trafficInfo: e.target.value })}
                  onFocus={() => setActiveSection('location')}
                />
                <div className="mt-3 space-y-2 border-t pt-3">
                  <span className="text-xs font-semibold block">대중교통 안내 이미지</span>
                  {currentInvitation?.customStyles?.subwayImage ? (
                    <div className="space-y-2">
                      <div className="relative w-40 aspect-video rounded border overflow-hidden bg-muted">
                        <img src={currentInvitation.customStyles.subwayImage} className="w-full h-full object-cover" />
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute right-1 top-1 h-6 w-6" 
                          onClick={() => updateCustomStyle('subwayImage', null)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground block">노출 방식</span>
                          <Select
                            value={currentInvitation.customStyles?.subwayDisplayType || 'popup'}
                            onValueChange={(val) => updateCustomStyle('subwayDisplayType', val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="popup">팝업 버튼 노출</SelectItem>
                              <SelectItem value="direct">바로 이미지 출력</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {currentInvitation.customStyles?.subwayDisplayType !== 'direct' && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground block">버튼 문구</span>
                            <Input 
                              className="h-8 text-xs" 
                              placeholder="이미지 보기" 
                              value={currentInvitation.customStyles?.subwayButtonText || ''} 
                              onChange={(e) => updateCustomStyle('subwayButtonText', e.target.value)} 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs"
                        onClick={() => subwayImageInputRef.current?.click()}
                        disabled={isUploadingSubway}
                      >
                        {isUploadingSubway ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                        이미지 추가
                      </Button>
                      <input 
                        type="file" 
                        ref={subwayImageInputRef} 
                        onChange={(e) => handleTransportImageUpload(e, 'subway')} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>
                  )}
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="parkingInfo">주차 안내</FieldLabel>
                <Textarea
                  id="parkingInfo"
                  placeholder="주차장 이용 방법을 안내해주세요"
                  rows={3}
                  value={currentInvitation?.parkingInfo || ''}
                  onChange={(e) => updateCurrentInvitation({ parkingInfo: e.target.value })}
                  onFocus={() => setActiveSection('location')}
                />
                <div className="mt-3 space-y-2 border-t pt-3">
                  <span className="text-xs font-semibold block">자가용 / 주차 안내 이미지</span>
                  {currentInvitation?.customStyles?.parkingImage ? (
                    <div className="space-y-2">
                      <div className="relative w-40 aspect-video rounded border overflow-hidden bg-muted">
                        <img src={currentInvitation.customStyles.parkingImage} className="w-full h-full object-cover" />
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute right-1 top-1 h-6 w-6" 
                          onClick={() => updateCustomStyle('parkingImage', null)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground block">노출 방식</span>
                          <Select
                            value={currentInvitation.customStyles?.parkingDisplayType || 'popup'}
                            onValueChange={(val) => updateCustomStyle('parkingDisplayType', val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="popup">팝업 버튼 노출</SelectItem>
                              <SelectItem value="direct">바로 이미지 출력</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {currentInvitation.customStyles?.parkingDisplayType !== 'direct' && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground block">버튼 문구</span>
                            <Input 
                              className="h-8 text-xs" 
                              placeholder="이미지 보기" 
                              value={currentInvitation.customStyles?.parkingButtonText || ''} 
                              onChange={(e) => updateCustomStyle('parkingButtonText', e.target.value)} 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs"
                        onClick={() => parkingImageInputRef.current?.click()}
                        disabled={isUploadingParking}
                      >
                        {isUploadingParking ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                        이미지 추가
                      </Button>
                      <input 
                        type="file" 
                        ref={parkingImageInputRef} 
                        onChange={(e) => handleTransportImageUpload(e, 'parking')} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>
                  )}
                </div>
              </Field>

              <div className="flex items-center justify-between border-t pt-4 mt-2">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium block">오시는 길 지도 노출</span>
                  <p className="text-xs text-muted-foreground">약도 지도 및 국내 지도 앱 연결 버튼을 노출합니다.</p>
                </div>
                <Switch 
                  checked={currentInvitation?.customStyles?.mapEnabled !== false}
                  onCheckedChange={(checked) => updateCustomStyle('mapEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-4 mt-2">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium block">셔틀버스 안내 추가</span>
                  <p className="text-xs text-muted-foreground">셔틀버스 운행 정보가 있는 경우 활성화해주세요.</p>
                </div>
                <Switch 
                  checked={currentInvitation?.customStyles?.shuttleEnabled || false}
                  onCheckedChange={(checked) => updateCustomStyle('shuttleEnabled', checked)}
                />
              </div>

              {currentInvitation?.customStyles?.shuttleEnabled && (
                <Field>
                  <FieldLabel htmlFor="shuttleInfo">셔틀버스 안내</FieldLabel>
                  <Textarea
                    id="shuttleInfo"
                    placeholder="셔틀버스 탑승 위치, 시간 등을 안내해주세요"
                    rows={3}
                    value={currentInvitation?.customStyles?.shuttleInfo || ''}
                    onChange={(e) => updateCustomStyle('shuttleInfo', e.target.value)}
                    onFocus={() => setActiveSection('location')}
                  />
                </Field>
              )}
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>

        {/* RSVP */}
        <AccordionItem value="rsvp" className="rounded-lg border border-border">
          <AccordionTrigger className="px-4 hover:no-underline">
            <span className="font-medium">RSVP (참석여부)</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">RSVP 기능 사용</p>
                <p className="text-sm text-muted-foreground">
                  하객이 참석여부를 미리 알려줄 수 있습니다.
                </p>
              </div>
              <Switch
                checked={currentInvitation?.rsvpEnabled || false}
                onCheckedChange={(checked) => {
                  updateCurrentInvitation({ rsvpEnabled: checked })
                  setActiveSection('rsvp')
                }}
              />
            </div>
            {currentInvitation?.rsvpEnabled && (
              <div className="mt-4 space-y-4 rounded-lg bg-muted/50 p-4 border border-border">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">기본 수집 정보 (고정)</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-background text-foreground border border-border">성함</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-background text-foreground border border-border">참석 여부</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-background text-foreground border border-border">참석 인원</span>
                  </div>
                </div>
                
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">추가 옵션 설정</p>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">식사 선택 기능</p>
                      <p className="text-xs text-muted-foreground">하객이 한식/양식 등의 식사 선호를 선택하게 합니다.</p>
                    </div>
                    <Switch
                      checked={currentInvitation?.rsvpMealEnabled !== false}
                      onCheckedChange={(checked) => {
                        updateCurrentInvitation({ rsvpMealEnabled: checked })
                        setActiveSection('rsvp')
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-3">
                    <div>
                      <p className="text-sm font-medium">축하 메시지 입력</p>
                      <p className="text-xs text-muted-foreground">하객이 참석 정보와 함께 축하 메시지를 남길 수 있게 합니다.</p>
                    </div>
                    <Switch
                      checked={currentInvitation?.rsvpCommentEnabled !== false}
                      onCheckedChange={(checked) => {
                        updateCurrentInvitation({ rsvpCommentEnabled: checked })
                        setActiveSection('rsvp')
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Bank Accounts */}
        <AccordionItem value="bank" className="rounded-lg border border-border">
          <AccordionTrigger className="px-4 hover:no-underline">
            <span className="font-medium">송금/연락처</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h4 className="font-medium">계좌번호</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">노출 형식:</span>
                    <Select
                      value={currentInvitation?.customStyles?.accountLayout || '1col'}
                      onValueChange={(val) => {
                        const customStyles = {
                          ...(currentInvitation?.customStyles || {}),
                          accountLayout: val
                        }
                        updateCurrentInvitation({ customStyles })
                        setActiveSection('account')
                      }}
                    >
                      <SelectTrigger className="w-[125px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1col">1열 배치 (세로)</SelectItem>
                        <SelectItem value="2col">2열 배치 (좌우)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(currentInvitation?.bankAccounts || []).map((account, index) => (
                  <div key={account.id} className="mb-2 flex items-center gap-2 rounded-lg border border-border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {account.relation === 'groom' && '신랑 '}
                        {account.relation === 'bride' && '신부 '}
                        {account.relation === 'groomParent' && '신랑 혼주 '}
                        {account.relation === 'brideParent' && '신부 혼주 '}
                        · {account.bank} {account.accountNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">{account.accountHolder}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setEditingAccountId(account.id)
                        setNewAccount({
                          bank: account.bank,
                          accountNumber: account.accountNumber,
                          accountHolder: account.accountHolder,
                          relation: account.relation
                        })
                        setIsAccountDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        const newAccounts = [...(currentInvitation?.bankAccounts || [])]
                        newAccounts.splice(index, 1)
                        updateCurrentInvitation({ bankAccounts: newAccounts })
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <Dialog open={isAccountDialogOpen} onOpenChange={(open) => {
                  setIsAccountDialogOpen(open)
                  if (!open) {
                    setEditingAccountId(null)
                    setNewAccount({ bank: '', accountNumber: '', accountHolder: '', relation: 'groom' })
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" onClick={() => {
                      setActiveSection('account')
                      setEditingAccountId(null)
                      setNewAccount({ bank: '', accountNumber: '', accountHolder: '', relation: 'groom' })
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      계좌 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingAccountId ? '계좌 수정' : '계좌 추가'}</DialogTitle>
                      <DialogDescription>축의금을 받을 계좌번호를 입력해주세요.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="acc-relation">관계</Label>
                        <Select
                          value={newAccount.relation}
                          onValueChange={(val: any) => setNewAccount({ ...newAccount, relation: val })}
                        >
                          <SelectTrigger id="acc-relation">
                            <SelectValue placeholder="관계를 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="groom">신랑</SelectItem>
                            <SelectItem value="bride">신부</SelectItem>
                            <SelectItem value="groomParent">신랑 혼주</SelectItem>
                            <SelectItem value="brideParent">신부 혼주</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-bank">은행명</Label>
                        <Input
                          id="acc-bank"
                          placeholder="예: 신한은행, 국민은행"
                          value={newAccount.bank}
                          onChange={(e) => setNewAccount({ ...newAccount, bank: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-number">계좌번호</Label>
                        <Input
                          id="acc-number"
                          placeholder="예: 110-123-456789"
                          value={newAccount.accountNumber}
                          onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-holder">예금주</Label>
                        <Input
                          id="acc-holder"
                          placeholder="예: 홍길동"
                          value={newAccount.accountHolder}
                          onChange={(e) => setNewAccount({ ...newAccount, accountHolder: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleAddAccount}>
                      {editingAccountId ? '수정 완료' : '추가 완료'}
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>

              <div>
                <h4 className="mb-2 font-medium">연락처</h4>
                {(currentInvitation?.contacts || []).map((contact, index) => (
                  <div key={contact.id} className="mb-2 flex items-center gap-2 rounded-lg border border-border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {contact.name} ({
                          contact.relation === 'groom' ? '신랑' :
                          contact.relation === 'bride' ? '신부' :
                          contact.relation === 'groomParent' ? '신랑 혼주' :
                          contact.relation === 'brideParent' ? '신부 혼주' :
                          contact.relation
                        })
                      </p>
                      <p className="text-xs text-muted-foreground">{contact.phone}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setEditingContactId(contact.id)
                        setNewContact({
                          name: contact.name,
                          phone: contact.phone,
                          relation: contact.relation
                        })
                        setIsContactDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        const newContacts = [...(currentInvitation?.contacts || [])]
                        newContacts.splice(index, 1)
                        updateCurrentInvitation({ contacts: newContacts })
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Dialog open={isContactDialogOpen} onOpenChange={(open) => {
                  setIsContactDialogOpen(open)
                  if (!open) {
                    setEditingContactId(null)
                    setNewContact({ name: '', phone: '', relation: 'groom' })
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" onClick={() => {
                      setActiveSection('contact')
                      setEditingContactId(null)
                      setNewContact({ name: '', phone: '', relation: 'groom' })
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      연락처 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingContactId ? '연락처 수정' : '연락처 추가'}</DialogTitle>
                      <DialogDescription>하객들이 연락할 수 있는 전화번호를 입력해주세요.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="con-name">이름</Label>
                        <Input
                          id="con-name"
                          placeholder="예: 홍길동"
                          value={newContact.name}
                          onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="con-relation">관계</Label>
                        <Select
                          value={newContact.relation}
                          onValueChange={(val: any) => setNewContact({ ...newContact, relation: val })}
                        >
                          <SelectTrigger id="con-relation">
                            <SelectValue placeholder="관계를 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="groom">신랑</SelectItem>
                            <SelectItem value="bride">신부</SelectItem>
                            <SelectItem value="groomParent">신랑 혼주</SelectItem>
                            <SelectItem value="brideParent">신부 혼주</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="con-phone">전화번호</Label>
                        <Input
                          id="con-phone"
                          placeholder="예: 010-1234-5678"
                          value={newContact.phone}
                          onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleAddContact}>
                      {editingContactId ? '수정 완료' : '추가 완료'}
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Section Insert Images */}
      <Card>
        <CardHeader>
          <CardTitle>섹션 사이 사진 삽입</CardTitle>
          <CardDescription>각 섹션 아래에 원하는 사진을 삽입합니다. 사진은 모바일 가로 꽉 차게 배치됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const sectionLabelsForImages: Record<string, string> = {
              hero: '메인 (Hero)', sequence: '식순 안내', gallery: '사진첩',
              calendar: '소중한 날 (달력)', location: '식장 위치', contact: '연락처',
              account: '마음 전하실 곳', rsvp: '참석 의사 알리기', guestbook: '방명록'
            }
            const sectionImages: Record<string, { url: string; caption?: string }[]> = currentInvitation?.customStyles?.sectionImages || {}
            const allSections = ['hero', ...(currentInvitation?.customStyles?.sectionOrder || ['sequence', 'gallery', 'calendar', 'location', 'contact', 'account', 'rsvp', 'guestbook'])]

            const updateSectionImages = (sectionId: string, images: { url: string; caption?: string }[]) => {
              updateCurrentInvitation({
                customStyles: {
                  ...(currentInvitation?.customStyles || {}),
                  sectionImages: { ...sectionImages, [sectionId]: images }
                }
              })
            }

            return allSections.map(sectionId => {
              const images = sectionImages[sectionId] || []
              return (
                <div key={sectionId} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{sectionLabelsForImages[sectionId] || sectionId} <span className="text-muted-foreground font-normal">아래에 삽입</span></p>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            const url = await uploadFile(file, 'section-images')
                            const updated = [...images, { url, caption: '' }]
                            updateSectionImages(sectionId, updated)
                          } catch (err) {
                            console.error(err)
                          }
                          e.target.value = ''
                        }}
                      />
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-dashed border-muted-foreground/40 hover:border-primary hover:text-primary transition-colors">
                        <Image className="h-3 w-3" />
                        사진 추가
                      </span>
                    </label>
                  </div>
                  {images.length > 0 && (
                    <div className="space-y-2">
                      {images.map((img, imgIdx) => (
                        <div key={imgIdx} className="flex items-center gap-2 bg-muted/30 rounded p-2">
                          <img src={img.url} alt={`preview ${imgIdx}`} className="w-10 h-10 object-cover rounded shrink-0 border" />
                          <Input
                            className="h-7 text-xs flex-1"
                            placeholder="캡션 (선택사항)"
                            value={img.caption || ''}
                            onChange={(e) => {
                              const updated = images.map((item, i) => i === imgIdx ? { ...item, caption: e.target.value } : item)
                              updateSectionImages(sectionId, updated)
                            }}
                          />
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 shrink-0"
                            type="button"
                            onClick={() => {
                              const updated = images.filter((_, i) => i !== imgIdx)
                              updateSectionImages(sectionId, updated)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          이전 단계
        </Button>
        <Button onClick={handleNext}>
          다음 단계
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
