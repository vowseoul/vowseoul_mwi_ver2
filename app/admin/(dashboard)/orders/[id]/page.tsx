'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MobilePreview } from '@/components/mobile-preview'
import { useAppStore, sampleThemes, samplePhrases, type BankAccount, type Contact, type Order } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { uploadFile } from '@/lib/storage'
import { ChevronLeft, Save, Upload, Loader2, Plus, Trash2, Play, Pause, FileText, ArrowUp, ArrowDown, ExternalLink, Pencil, Image, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const parseIndividualParents = (fullRelation: string) => {
  const result = { fatherName: '', motherName: '', relationText: '' }
  if (!fullRelation) return result

  // Pattern 1: "아버지 김철수, 어머니 이영희의 장남"
  const pattern1 = /아버지\s*([^\s,··]+)[,\s·]*어머니\s*([^\s의]+)의\s*(.*)/
  const match1 = fullRelation.match(pattern1)
  if (match1) {
    result.fatherName = match1[1].trim()
    result.motherName = match1[2].trim()
    result.relationText = `의 ${match1[3].trim()}`
    return result
  }

  // Pattern 2: "김태진 · 정혜선 의 아들"
  const pattern2 = /^([^\s의,·]+)[,\s·]+([^\s의,·]+)\s*의\s*(.*)/
  const match2 = fullRelation.match(pattern2)
  if (match2) {
    result.fatherName = match2[1].trim()
    result.motherName = match2[2].trim()
    result.relationText = `의 ${match2[3].trim()}`
    return result
  }

  // Pattern 3: "김태진 의 아들"
  const pattern3 = /^([^\s의]+)\s*의\s*(.*)/
  const match3 = fullRelation.match(pattern3)
  if (match3) {
    result.fatherName = match3[1].trim()
    result.relationText = `의 ${match3[2].trim()}`
    return result
  }

  return result
}

const parseParentNames = (fullRelation: string) => {
  if (!fullRelation) return ''
  const match = fullRelation.match(/^(.*?)(의\s+아들|의\s+딸|의\s*\S*)$/)
  return match ? match[1].trim() : fullRelation
}

const parseRelationText = (fullRelation: string) => {
  if (!fullRelation) return ''
  const match = fullRelation.match(/^(.*?)(의\s+아들|의\s+딸|의\s*\S*)$/)
  return match ? match[2].trim() : ''
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const { 
    currentInvitation, 
    setCurrentInvitation, 
    updateCurrentInvitation,
    themes,
    fetchData
  } = useAppStore()

  const [order, setOrder] = useState<Order | null>(null)
  const [bgms, setBgms] = useState<any[]>([])
  const [customFonts, setCustomFonts] = useState<any[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('order')

  // Upload States
  const [isUploadingMain, setIsUploadingMain] = useState(false)
  const [isUploadingGallery, setIsUploadingGallery] = useState(false)
  const [isUploadingKakao, setIsUploadingKakao] = useState(false)
  const [isUploadingSubway, setIsUploadingSubway] = useState(false)
  const [isUploadingParking, setIsUploadingParking] = useState(false)
  const [isUploadingShape, setIsUploadingShape] = useState(false)
  const calendarShapeInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingGreetingIcon, setIsUploadingGreetingIcon] = useState(false)
  const [isUploadingGroom, setIsUploadingGroom] = useState(false)
  const [isUploadingBride, setIsUploadingBride] = useState(false)

  // Dialog / Modal States
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [newAccount, setNewAccount] = useState({
    bank: '',
    accountNumber: '',
    accountHolder: '',
    relation: 'groom' as 'groom' | 'bride' | 'groomParent' | 'brideParent'
  })

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relation: 'groom'
  })

  const [showMessageModal, setShowMessageModal] = useState(false)

  // Audio Play States
  const [playingBgmUrl, setPlayingBgmUrl] = useState<string | null>(null)
  const [activeHeaderSection, setActiveHeaderSection] = useState('gallery')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Refs
  const mainImageInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const kakaoImageInputRef = useRef<HTMLInputElement>(null)
  const subwayImageInputRef = useRef<HTMLInputElement>(null)
  const parkingImageInputRef = useRef<HTMLInputElement>(null)
  const greetingIconInputRef = useRef<HTMLInputElement>(null)
  const groomImageInputRef = useRef<HTMLInputElement>(null)
  const brideImageInputRef = useRef<HTMLInputElement>(null)

  // Load Initial Data
  useEffect(() => {
    fetchData()
    fetchBgms()
    fetchFonts()
    loadOrderAndInvitation()

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [orderId])

  const fetchBgms = async () => {
    const { data } = await supabase.from('bgms').select('*')
    if (data) setBgms(data)
  }

  const fetchFonts = async () => {
    try {
      const { data } = await supabase.from('settings').select('*').eq('key', 'fonts')
      if (data && data.length > 0 && data[0].value) {
        setCustomFonts(data[0].value)
      }
    } catch (e) {
      console.error('Error fetching fonts:', e)
    }
  }

  const loadOrderAndInvitation = async () => {
    setIsLoading(true)
    try {
      // 1. Load Order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderError) throw orderError
      if (orderData) {
        setOrder(orderData)

        // 2. Load Invitation
        let inviteData = null
        const { data: fetchInvite, error: inviteError } = await supabase
          .from('invitations')
          .select('*')
          .eq('id', orderData.invitationId)
          .single()

        if (inviteError) {
          if (inviteError.code === 'PGRST116') {
            console.warn(`Invitation ${orderData.invitationId} not found, generating default fallback.`)
            inviteData = {
              id: orderData.invitationId,
              groomName: orderData.groomName || '신랑',
              groomNameEn: 'Groom',
              groomParentRelation: '의 아들',
              brideName: orderData.brideName || '신부',
              brideNameEn: 'Bride',
              brideParentRelation: '의 딸',
              weddingDate: orderData.weddingDate || new Date().toISOString().split('T')[0],
              weddingTime: '12:00',
              venueName: '예식장',
              venueHall: '그랜드홀',
              venueAddress: '서울시',
              themeId: 'classic-white',
              colorSet: 'ivory',
              fontSet: 'serif',
              mainImage: null,
              invitationMessage: '서로 다른 길을 걸어온 저희 두 사람이\n이제 하나의 길을 함께 걸어가려 합니다.\n귀한 걸음으로 축복해 주시면 감사하겠습니다.',
              galleryImages: [],
              galleryViewType: 'slide',
              trafficInfo: '',
              parkingInfo: '',
              rsvpEnabled: false,
              guestbookType: 'text',
              bgmId: null,
              kakaoThumbnail: null,
              kakaoTitle: `${orderData.groomName || '신랑'} ♥ ${orderData.brideName || '신부'} 결혼합니다`,
              kakaoDescription: `${orderData.weddingDate || ''} 결혼식에 초대합니다.`,
              bankAccounts: [],
              contacts: [],
              status: 'draft',
              createdAt: new Date().toISOString(),
              publishedUrl: null,
              customStyles: {}
            }
          } else {
            throw inviteError
          }
        } else {
          inviteData = fetchInvite
        }

        if (inviteData) {
          // Normalize customStyles in case it is null/undefined
          const normalizedInvitation = {
            ...inviteData,
            customStyles: inviteData.customStyles || {}
          }
          setCurrentInvitation(normalizedInvitation)
        }
      }
    } catch (err: any) {
      console.error('Error loading order or invitation:', err)
      toast.error('주문 정보 또는 청첩장을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!order || !currentInvitation) return
    setIsSaving(true)
    try {
      const matchedTheme = themes.find(t => t.id === currentInvitation.themeId) || 
                           sampleThemes.find(t => t.id === currentInvitation.themeId)
      const themeName = matchedTheme ? matchedTheme.name : (order.theme || 'Classic White')

      const updatedOrderData = {
        customerName: order.customerName,
        amount: order.amount,
        status: order.status,
        notes: order.notes,
        weddingDate: currentInvitation.weddingDate || order.weddingDate,
        groomName: currentInvitation.groomName || '신랑',
        brideName: currentInvitation.brideName || '신부',
        theme: themeName
      }

      // 1. Update Order in DB
      const { error: orderError } = await supabase
        .from('orders')
        .update(updatedOrderData)
        .eq('id', orderId)

      if (orderError) throw orderError

      // 2. Update Invitation in DB
      const { error: inviteError } = await supabase
        .from('invitations')
        .upsert(currentInvitation)

      if (inviteError) throw inviteError

      // 3. Update local state and store
      const fullUpdatedOrder = { ...order, ...updatedOrderData }
      setOrder(fullUpdatedOrder)
      useAppStore.setState((state) => ({
        orders: state.orders.map(o => o.id === orderId ? fullUpdatedOrder : o)
      }))

      toast.success('설정이 성공적으로 저장되었습니다!')
    } catch (err: any) {
      console.error('Error saving configurations:', err)
      
      const isMissingColumn = err.code === 'PGRST204' || 
                              (err.message && (err.message.includes('customStyles') || err.message.includes('column')));
      
      if (isMissingColumn) {
        toast.error(
          'Supabase 테이블에 "customStyles" 컬럼이 없거나 캐시되지 않았습니다. Supabase SQL Editor에서 ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS "customStyles" jsonb; 를 실행해주세요.',
          { duration: 8000 }
        )
      } else {
        toast.error(err.message || '저장 중 오류가 발생했습니다.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Address lookup via Daum Postcode API
  const handleAddressSearch = () => {
    const script = document.createElement('script')
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.onload = () => {
      // @ts-ignore
      new window.daum.Postcode({
        oncomplete: function(data: any) {
          let fullAddr = data.address
          let extraAddr = ''
          if(data.addressType === 'R'){
            if(data.bname !== ''){
              extraAddr += data.bname
            }
            if(data.buildingName !== ''){
              extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName)
            }
            fullAddr += (extraAddr !== '' ? ' ('+ extraAddr +')' : '')
          }
          updateCurrentInvitation({ venueAddress: fullAddr })
        }
      }).open()
    }
    document.body.appendChild(script)
  }

  // Image Upload Handlers
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
      toast.success(`${isGroom ? '신랑' : '신부'} 프로필 사진이 업로드되었습니다.`)
    } catch (err) {
      toast.error('프로필 사진 업로드에 실패했습니다.')
    } finally {
      if (isGroom) setIsUploadingGroom(false)
      else setIsUploadingBride(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingMain(true)
    try {
      const url = await uploadFile(e.target.files[0], 'main-images')
      updateCurrentInvitation({ mainImage: url })
      toast.success('대문 사진이 업로드되었습니다.')
    } catch (err) {
      toast.error('이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingMain(false)
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
      toast.success('갤러리 이미지가 추가되었습니다.')
    } catch (err) {
      toast.error('갤러리 이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingGallery(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleKakaoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingKakao(true)
    try {
      const url = await uploadFile(e.target.files[0], 'kakao-thumbnails')
      updateCurrentInvitation({ kakaoThumbnail: url })
      toast.success('카카오 공유 썸네일이 업로드되었습니다.')
    } catch (err) {
      toast.error('이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingKakao(false)
      if (e.target) e.target.value = ''
    }
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
      toast.success('교통 정보 이미지가 업로드되었습니다.')
    } catch (err) {
      toast.error('이미지 업로드에 실패했습니다.')
    } finally {
      if (isSub) setIsUploadingSubway(false)
      else setIsUploadingParking(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleCalendarShapeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingShape(true)
    try {
      const url = await uploadFile(e.target.files[0], 'calendar-shapes')
      const prevStyles = currentInvitation?.customStyles || {}
      updateCurrentInvitation({
        customStyles: {
          ...prevStyles,
          calendarDayCustomShapeUrl: url
        }
      })
      toast.success('강조 이미지가 업로드되었습니다.')
    } catch (err) {
      toast.error('강조 이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingShape(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleGreetingIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingGreetingIcon(true)
    try {
      const url = await uploadFile(e.target.files[0], 'greeting-icons')
      const prevStyles = currentInvitation?.customStyles || {}
      updateCurrentInvitation({
        customStyles: {
          ...prevStyles,
          greetingIconCustomUrl: url
        }
      })
      toast.success('아이콘 이미지가 업로드되었습니다.')
    } catch (err) {
      toast.error('아이콘 이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingGreetingIcon(false)
      if (e.target) e.target.value = ''
    }
  }

  // BGM Audio Play Handler
  const handlePlayBgm = (url: string) => {
    if (playingBgmUrl === url) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setPlayingBgmUrl(null)
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio()
      }
      audioRef.current.src = url
      audioRef.current.play().catch((e) => console.error(e))
      setPlayingBgmUrl(url)
    }
  }

  // bank account handlers
  const handleAddAccount = () => {
    if (!newAccount.bank || !newAccount.accountNumber || !newAccount.accountHolder) {
      toast.error('모든 계좌 정보를 입력해주세요.')
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
    setNewAccount({ bank: '', accountNumber: '', accountHolder: '', relation: 'groom' })
  }

  const handleDeleteAccount = (id: string) => {
    const currentAccounts = currentInvitation?.bankAccounts || []
    updateCurrentInvitation({ bankAccounts: currentAccounts.filter(acc => acc.id !== id) })
  }

  // contact handlers
  const handleAddContact = () => {
    if (!newContact.name || !newContact.phone || !newContact.relation) {
      toast.error('모든 연락처 정보를 입력해주세요.')
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
    setNewContact({ name: '', phone: '', relation: 'groom' })
  }

  const handleDeleteContact = (id: string) => {
    const currentContacts = currentInvitation?.contacts || []
    updateCurrentInvitation({ contacts: currentContacts.filter(con => con.id !== id) })
  }

  // custom styles handlers
  const updateCustomStyle = (key: string, value: any) => {
    if (!currentInvitation) return
    const customStyles = {
      ...(currentInvitation.customStyles || {}),
      [key]: value
    }
    updateCurrentInvitation({ customStyles })
  }

  const activeTheme = themes.find(t => t.id === currentInvitation?.themeId) || sampleThemes.find(t => t.id === currentInvitation?.themeId) || sampleThemes[0]
  const colorSet = activeTheme?.colorSets?.find(c => c.id === currentInvitation?.colorSet) || activeTheme?.colorSets?.[0]
  const defaultAccentColor = colorSet?.colors?.[1] || '#c4a574'
  const isCustomSvg = currentInvitation?.customStyles?.calendarDayCustomShapeUrl?.toLowerCase().split('?')[0].endsWith('.svg') ?? false

  // Reorder Sections
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!currentInvitation) return
    const defaultOrder = ['hero', 'greeting', 'sequence', 'gallery', 'calendar', 'location', 'contact', 'account', 'rsvp', 'guestbook']
    const rawOrder = currentInvitation.customStyles?.sectionOrder || activeTheme?.styles?.sectionOrder || defaultOrder
    const sectionOrder = rawOrder.includes('sequence')
      ? [...rawOrder]
      : (() => {
          const idx = rawOrder.indexOf('greeting')
          const newOrder = [...rawOrder]
          newOrder.splice(idx !== -1 ? idx + 1 : 2, 0, 'sequence')
          return newOrder
        })()
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= sectionOrder.length) return

    // Swap
    const temp = sectionOrder[index]
    sectionOrder[index] = sectionOrder[targetIndex]
    sectionOrder[targetIndex] = temp

    updateCustomStyle('sectionOrder', sectionOrder)
  }

  const sectionLabels: Record<string, string> = {
    hero: '대문 이미지 (Hero)',
    greeting: '인사말 (Greeting)',
    sequence: '식순 안내 (Sequence)',
    gallery: '갤러리 (Gallery)',
    calendar: '달력 (Calendar)',
    location: '예식장 위치/지도 (Location)',
    contact: '연락처 (Contact)',
    account: '축의금 송금 계좌 (Account)',
    rsvp: '참석 여부 (RSVP)',
    guestbook: '방명록 (Guestbook)'
  }

  if (isLoading || !order || !currentInvitation) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 -mt-2">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/orders">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">의뢰 청첩장 맞춤 제작</h1>
            <p className="text-muted-foreground">
              주문 번호: <span className="font-semibold">{order.id}</span> · 고객명:{' '}
              <span className="font-semibold">{order.customerName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentInvitation.id && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const url = `${window.location.origin}/invitation/${currentInvitation.id}/dashboard`
                  navigator.clipboard.writeText(url)
                  toast.success("고객용 대시보드 링크가 복사되었습니다.")
                }}
                className="flex items-center gap-1.5"
              >
                <Copy className="h-4 w-4" />
                대시보드 링크 복사
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/invitation/${currentInvitation.id}`} target="_blank" className="flex items-center gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  배포된 화면 보기
                </Link>
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="text-white bg-foreground hover:bg-foreground/90">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            설정 저장하기
          </Button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0 w-full">
        {/* Left Form Editor */}
        <div className="flex-1 overflow-y-auto pr-4 space-y-6 min-h-0 scrollbar-hide">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-5 w-full bg-background border border-border rounded-lg p-1">
              <TabsTrigger value="order">주문 관리</TabsTrigger>
              <TabsTrigger value="basic">기본 정보</TabsTrigger>
              <TabsTrigger value="content">내용 & 사진</TabsTrigger>
              <TabsTrigger value="features">상세 기능</TabsTrigger>
              <TabsTrigger value="design">스타일 커스텀</TabsTrigger>
            </TabsList>

            {/* TAB: Order Info */}
            <TabsContent value="order" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">주문 내역 제어</CardTitle>
                  <CardDescription>수동 등록된 개인 의뢰 주문 내역을 편집합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="custName">고객 / 주문자명</FieldLabel>
                      <Input
                        id="custName"
                        value={order.customerName}
                        onChange={(e) => setOrder({ ...order, customerName: e.target.value })}
                      />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="ordAmount">결제 금액 (원)</FieldLabel>
                        <Input
                          id="ordAmount"
                          type="number"
                          value={order.amount}
                          onChange={(e) => setOrder({ ...order, amount: parseInt(e.target.value) || 0 })}
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="ordStatus">주문 상태</FieldLabel>
                        <Select
                          value={order.status}
                          onValueChange={(val: Order['status']) => setOrder({ ...order, status: val })}
                        >
                          <SelectTrigger id="ordStatus">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">대기중</SelectItem>
                            <SelectItem value="paid">결제완료</SelectItem>
                            <SelectItem value="deployed">배포중</SelectItem>
                            <SelectItem value="expired">만료됨</SelectItem>
                            <SelectItem value="refunded">환불</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="ordNotes">관리 메모 / 특이사항</FieldLabel>
                      <Textarea
                        id="ordNotes"
                        rows={6}
                        placeholder="이곳에 제작 관련 의뢰 파일 링크나 가이드를 입력하세요."
                        value={order.notes}
                        onChange={(e) => setOrder({ ...order, notes: e.target.value })}
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Basic Info */}
            <TabsContent value="basic" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">신랑 & 신부 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Groom */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b pb-2">신랑측</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="gr-name">성함</FieldLabel>
                        <Input
                          id="gr-name"
                          value={currentInvitation.groomName || ''}
                          onChange={(e) => updateCurrentInvitation({ groomName: e.target.value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="gr-name-en">영문 이름</FieldLabel>
                        <Input
                          id="gr-name-en"
                          value={currentInvitation.groomNameEn || ''}
                          onChange={(e) => updateCurrentInvitation({ groomNameEn: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="gr-father-name">아버지 성함</FieldLabel>
                        <Input
                          id="gr-father-name"
                          placeholder="예: 홍길동"
                          value={currentInvitation?.customStyles?.groomFatherName !== undefined 
                            ? currentInvitation.customStyles.groomFatherName 
                            : parseIndividualParents(currentInvitation?.groomParentRelation || '').fatherName}
                          onChange={(e) => {
                            const father = e.target.value
                            const mother = currentInvitation?.customStyles?.groomMotherName !== undefined
                              ? currentInvitation.customStyles.groomMotherName
                              : parseIndividualParents(currentInvitation?.groomParentRelation || '').motherName
                            const relation = currentInvitation?.customStyles?.groomParentRelationText !== undefined
                              ? currentInvitation.customStyles.groomParentRelationText
                              : parseRelationText(currentInvitation?.groomParentRelation || '')
                            
                            const namesArr = []
                            if (father) namesArr.push(father)
                            if (mother) namesArr.push(mother)
                            const parentNamesCombined = namesArr.join(' · ')

                            let relationCombined = ''
                            if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                            else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                            else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                            else relationCombined = relation

                            updateCurrentInvitation({
                              groomParentRelation: relationCombined,
                              customStyles: {
                                ...(currentInvitation?.customStyles || {}),
                                groomFatherName: father,
                                groomMotherName: mother,
                                groomParentNames: parentNamesCombined,
                                groomParentRelationText: relation
                              }
                            })
                          }}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="gr-mother-name">어머니 성함</FieldLabel>
                        <Input
                          id="gr-mother-name"
                          placeholder="예: 김영희"
                          value={currentInvitation?.customStyles?.groomMotherName !== undefined 
                            ? currentInvitation.customStyles.groomMotherName 
                            : parseIndividualParents(currentInvitation?.groomParentRelation || '').motherName}
                          onChange={(e) => {
                            const mother = e.target.value
                            const father = currentInvitation?.customStyles?.groomFatherName !== undefined
                              ? currentInvitation.customStyles.groomFatherName
                              : parseIndividualParents(currentInvitation?.groomParentRelation || '').fatherName
                            const relation = currentInvitation?.customStyles?.groomParentRelationText !== undefined
                              ? currentInvitation.customStyles.groomParentRelationText
                              : parseRelationText(currentInvitation?.groomParentRelation || '')
                            
                            const namesArr = []
                            if (father) namesArr.push(father)
                            if (mother) namesArr.push(mother)
                            const parentNamesCombined = namesArr.join(' · ')

                            let relationCombined = ''
                            if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                            else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                            else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                            else relationCombined = relation

                            updateCurrentInvitation({
                              groomParentRelation: relationCombined,
                              customStyles: {
                                ...(currentInvitation?.customStyles || {}),
                                groomFatherName: father,
                                groomMotherName: mother,
                                groomParentNames: parentNamesCombined,
                                groomParentRelationText: relation
                              }
                            })
                          }}
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="gr-relation-text">관계 표기</FieldLabel>
                      <Input
                        id="gr-relation-text"
                        placeholder="예: 의 아들"
                        value={currentInvitation?.customStyles?.groomParentRelationText !== undefined 
                          ? currentInvitation.customStyles.groomParentRelationText 
                          : parseRelationText(currentInvitation?.groomParentRelation || '')}
                        onChange={(e) => {
                          const relation = e.target.value
                          const father = currentInvitation?.customStyles?.groomFatherName !== undefined
                            ? currentInvitation.customStyles.groomFatherName
                            : parseIndividualParents(currentInvitation?.groomParentRelation || '').fatherName
                          const mother = currentInvitation?.customStyles?.groomMotherName !== undefined
                            ? currentInvitation.customStyles.groomMotherName
                            : parseIndividualParents(currentInvitation?.groomParentRelation || '').motherName
                          
                          const namesArr = []
                          if (father) namesArr.push(father)
                          if (mother) namesArr.push(mother)
                          const parentNamesCombined = namesArr.join(' · ')

                          let relationCombined = ''
                          if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                          else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                          else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                          else relationCombined = relation

                          updateCurrentInvitation({
                            groomParentRelation: relationCombined,
                            customStyles: {
                              ...(currentInvitation?.customStyles || {}),
                              groomFatherName: father,
                              groomMotherName: mother,
                              groomParentNames: parentNamesCombined,
                              groomParentRelationText: relation
                            }
                          })
                        }}
                      />
                    </Field>
                  </div>

                  {/* Bride */}
                  <div className="space-y-4 pt-4">
                    <h3 className="font-semibold text-base border-b pb-2">신부측</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="br-name">성함</FieldLabel>
                        <Input
                          id="br-name"
                          value={currentInvitation.brideName || ''}
                          onChange={(e) => updateCurrentInvitation({ brideName: e.target.value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="br-name-en">영문 이름</FieldLabel>
                        <Input
                          id="br-name-en"
                          value={currentInvitation.brideNameEn || ''}
                          onChange={(e) => updateCurrentInvitation({ brideNameEn: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="br-father-name">아버지 성함</FieldLabel>
                        <Input
                          id="br-father-name"
                          placeholder="예: 이철수"
                          value={currentInvitation?.customStyles?.brideFatherName !== undefined 
                            ? currentInvitation.customStyles.brideFatherName 
                            : parseIndividualParents(currentInvitation?.brideParentRelation || '').fatherName}
                          onChange={(e) => {
                            const father = e.target.value
                            const mother = currentInvitation?.customStyles?.brideMotherName !== undefined
                              ? currentInvitation.customStyles.brideMotherName
                              : parseIndividualParents(currentInvitation?.brideParentRelation || '').motherName
                            const relation = currentInvitation?.customStyles?.brideParentRelationText !== undefined
                              ? currentInvitation.customStyles.brideParentRelationText
                              : parseRelationText(currentInvitation?.brideParentRelation || '')
                            
                            const namesArr = []
                            if (father) namesArr.push(father)
                            if (mother) namesArr.push(mother)
                            const parentNamesCombined = namesArr.join(' · ')

                            let relationCombined = ''
                            if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                            else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                            else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                            else relationCombined = relation

                            updateCurrentInvitation({
                              brideParentRelation: relationCombined,
                              customStyles: {
                                ...(currentInvitation?.customStyles || {}),
                                brideFatherName: father,
                                brideMotherName: mother,
                                brideParentNames: parentNamesCombined,
                                brideParentRelationText: relation
                              }
                            })
                          }}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="br-mother-name">어머니 성함</FieldLabel>
                        <Input
                          id="br-mother-name"
                          placeholder="예: 박미경"
                          value={currentInvitation?.customStyles?.brideMotherName !== undefined 
                            ? currentInvitation.customStyles.brideMotherName 
                            : parseIndividualParents(currentInvitation?.brideParentRelation || '').motherName}
                          onChange={(e) => {
                            const mother = e.target.value
                            const father = currentInvitation?.customStyles?.brideFatherName !== undefined
                              ? currentInvitation.customStyles.brideFatherName
                              : parseIndividualParents(currentInvitation?.brideParentRelation || '').fatherName
                            const relation = currentInvitation?.customStyles?.brideParentRelationText !== undefined
                              ? currentInvitation.customStyles.brideParentRelationText
                              : parseRelationText(currentInvitation?.brideParentRelation || '')
                            
                            const namesArr = []
                            if (father) namesArr.push(father)
                            if (mother) namesArr.push(mother)
                            const parentNamesCombined = namesArr.join(' · ')

                            let relationCombined = ''
                            if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                            else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                            else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                            else relationCombined = relation

                            updateCurrentInvitation({
                              brideParentRelation: relationCombined,
                              customStyles: {
                                ...(currentInvitation?.customStyles || {}),
                                brideFatherName: father,
                                brideMotherName: mother,
                                brideParentNames: parentNamesCombined,
                                brideParentRelationText: relation
                              }
                            })
                          }}
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="br-relation-text">관계 표기</FieldLabel>
                      <Input
                        id="br-relation-text"
                        placeholder="예: 의 장녀"
                        value={currentInvitation?.customStyles?.brideParentRelationText !== undefined 
                          ? currentInvitation.customStyles.brideParentRelationText 
                          : parseRelationText(currentInvitation?.brideParentRelation || '')}
                        onChange={(e) => {
                          const relation = e.target.value
                          const father = currentInvitation?.customStyles?.brideFatherName !== undefined
                            ? currentInvitation.customStyles.brideFatherName
                            : parseIndividualParents(currentInvitation?.brideParentRelation || '').fatherName
                          const mother = currentInvitation?.customStyles?.brideMotherName !== undefined
                            ? currentInvitation.customStyles.brideMotherName
                            : parseIndividualParents(currentInvitation?.brideParentRelation || '').motherName
                          
                          const namesArr = []
                          if (father) namesArr.push(father)
                          if (mother) namesArr.push(mother)
                          const parentNamesCombined = namesArr.join(' · ')

                          let relationCombined = ''
                          if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                          else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                          else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                          else relationCombined = relation

                          updateCurrentInvitation({
                            brideParentRelation: relationCombined,
                            customStyles: {
                              ...(currentInvitation?.customStyles || {}),
                              brideFatherName: father,
                              brideMotherName: mother,
                              brideParentNames: parentNamesCombined,
                              brideParentRelationText: relation
                            }
                          })
                        }}
                      />
                    </Field>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">예식 일시 및 장소</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="w-date">예식 날짜</FieldLabel>
                      <Input
                        id="w-date"
                        type="date"
                        value={currentInvitation.weddingDate || ''}
                        onChange={(e) => updateCurrentInvitation({ weddingDate: e.target.value })}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="w-time">예식 시간</FieldLabel>
                      <Input
                        id="w-time"
                        placeholder="예: 12:30 또는 오후 1시 30분"
                        value={currentInvitation.weddingTime || ''}
                        onChange={(e) => updateCurrentInvitation({ weddingTime: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="v-name">예식장명</FieldLabel>
                      <Input
                        id="v-name"
                        placeholder="예: 아펠가모 반포"
                        value={currentInvitation.venueName || ''}
                        onChange={(e) => updateCurrentInvitation({ venueName: e.target.value })}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="v-hall">홀 이름</FieldLabel>
                      <Input
                        id="v-hall"
                        placeholder="예: 단독홀 또는 2층 그랜드볼룸"
                        value={currentInvitation.venueHall || ''}
                        onChange={(e) => updateCurrentInvitation({ venueHall: e.target.value })}
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="v-addr">예식장 주소</FieldLabel>
                    <div className="flex flex-col gap-2">
                      <Textarea
                        id="v-addr"
                        placeholder="주소를 선택하거나 입력하세요 (원하는 위치에서 줄바꿈이 가능합니다)"
                        value={currentInvitation.venueAddress || ''}
                        onChange={(e) => updateCurrentInvitation({ venueAddress: e.target.value })}
                        className="min-h-[80px]"
                      />
                      <Button variant="outline" type="button" onClick={handleAddressSearch} className="self-end">
                        주소 검색
                      </Button>
                    </div>
                  </Field>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Content & Images */}
            <TabsContent value="content" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">초대 인사말</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">하객들을 모시는 정중한 초대글을 입력하세요.</span>
                    <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <FileText className="mr-2 h-4 w-4" />
                          샘플 문구 보기
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[80vh] overflow-auto">
                        <DialogHeader>
                          <DialogTitle>샘플 문구</DialogTitle>
                          <DialogDescription>선택하시면 초대 인사말 창에 자동으로 입력됩니다.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 mt-4">
                          {samplePhrases.map((phrase) => (
                            <button
                              key={phrase.id}
                              onClick={() => {
                                updateCurrentInvitation({ invitationMessage: phrase.text })
                                setShowMessageModal(false)
                              }}
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
                  </div>
                  <Textarea
                    rows={8}
                    value={currentInvitation.invitationMessage || ''}
                    onChange={(e) => updateCurrentInvitation({ invitationMessage: e.target.value })}
                  />
                </CardContent>
              </Card>

              {/* Pink Envelope Profile Photos (Admin custom edit) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pink Envelope 프로필 사진</CardTitle>
                  <CardDescription>Pink Envelope 테마 적용 시 렌더링되는 신랑, 신부의 프로필 사진을 관리합니다.</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              {/* Main Photo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">대문 사진 (Hero Image)</CardTitle>
                  <CardDescription>청첩장의 메인 비주얼 사진을 업로드합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 overflow-hidden">
                    {currentInvitation.mainImage ? (
                      <div className="relative h-full w-full">
                        <img 
                          src={currentInvitation.mainImage} 
                          alt="대문 사진" 
                          className="h-full w-full object-cover"
                        />
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="absolute right-2 top-2"
                          onClick={() => updateCurrentInvitation({ mainImage: null })}
                        >
                          삭제
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => mainImageInputRef.current?.click()}
                          disabled={isUploadingMain}
                        >
                          {isUploadingMain ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          사진 업로드
                        </Button>
                        <input 
                          type="file"
                          ref={mainImageInputRef}
                          onChange={handleMainImageUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gallery */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">하객용 포토 갤러리</CardTitle>
                    <CardDescription>웨딩 포토 이미지를 추가 및 정렬합니다.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={currentInvitation.galleryViewType || 'slide'}
                      onValueChange={(val: any) => updateCurrentInvitation({ galleryViewType: val })}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slide">슬라이드형</SelectItem>
                        <SelectItem value="grid">그리드형</SelectItem>
                      </SelectContent>
                    </Select>
                    {currentInvitation.galleryViewType === 'slide' && (
                      <Select
                        value={currentInvitation.customStyles?.galleryAlign || 'center'}
                        onValueChange={(val: any) => updateCustomStyle('galleryAlign', val)}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue placeholder="정렬 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="center">중앙 정렬</SelectItem>
                          <SelectItem value="bottom">하단 정렬</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <Button size="sm" onClick={() => galleryInputRef.current?.click()} disabled={isUploadingGallery}>
                      {isUploadingGallery ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                      사진 추가
                    </Button>
                    <input 
                      type="file" 
                      ref={galleryInputRef} 
                      onChange={handleGalleryUpload} 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {(currentInvitation.galleryImages || []).map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg border border-border overflow-hidden bg-muted group">
                        <img src={img} alt="갤러리" className="h-full w-full object-cover" />
                        <button
                          onClick={() => {
                            const updated = (currentInvitation.galleryImages || []).filter((_, i) => i !== idx)
                            updateCurrentInvitation({ galleryImages: updated })
                          }}
                          className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {(currentInvitation.galleryImages || []).length === 0 && (
                      <div className="col-span-3 py-8 text-center text-xs text-muted-foreground">
                        등록된 갤러리 이미지가 없습니다.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Timeline / Sequence Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg">식순 안내 설정</CardTitle>
                  <Switch
                    checked={currentInvitation.customStyles?.sequenceEnabled || false}
                    onCheckedChange={(checked) => updateCustomStyle('sequenceEnabled', checked)}
                  />
                </CardHeader>
                {currentInvitation.customStyles?.sequenceEnabled && (
                  <CardContent className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="seq-title">대제목</FieldLabel>
                        <Input
                          id="seq-title"
                          placeholder="식순 안내"
                          value={currentInvitation.customStyles?.sequenceTitle || ''}
                          onChange={(e) => updateCustomStyle('sequenceTitle', e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="seq-subtitle">소제목 (영문)</FieldLabel>
                        <Input
                          id="seq-subtitle"
                          placeholder="WEDDING ORDER"
                          value={currentInvitation.customStyles?.sequenceSubtitle || ''}
                          onChange={(e) => updateCustomStyle('sequenceSubtitle', e.target.value)}
                        />
                      </Field>
                    </div>

                    <div className="space-y-3 pt-3 border-t">
                      <span className="text-xs font-semibold block">식순 목록</span>
                      <div className="space-y-2">
                        {((currentInvitation.customStyles?.sequenceEvents) || [
                          { id: '1', time: '12:00', title: '식전 영상 상영' },
                          { id: '2', time: '12:10', title: '개식 및 화촉점화' },
                          { id: '3', time: '12:20', title: '신랑 신부 입장' },
                          { id: '4', time: '12:30', title: '혼인서약 및 성혼선언' },
                          { id: '5', time: '12:45', title: '축가 및 하객 인사' },
                          { id: '6', time: '13:00', title: '신랑 신부 행진 및 폐식' }
                        ]).map((event: any, index: number) => {
                          const eventTime = event.time || '12:00';
                          const [hour, minute] = eventTime.split(':');
                          const eventsList = (currentInvitation.customStyles?.sequenceEvents) || [
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
                            <div key={event.id || index} className="flex items-center gap-2 bg-muted/40 p-2 rounded border border-border">
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
                          const eventsList = (currentInvitation.customStyles?.sequenceEvents) || [
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
                  </CardContent>
                )}
              </Card>

              {/* Location Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">오시는 길 교통 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="t-info">지하철 / 대중교통 안내</FieldLabel>
                      <Textarea
                        id="t-info"
                        rows={3}
                        placeholder="예: 3호선 신사역 4번 출구 도보 5분 거리"
                        value={currentInvitation.trafficInfo || ''}
                        onChange={(e) => updateCurrentInvitation({ trafficInfo: e.target.value })}
                      />
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <span className="text-xs font-semibold block">대중교통 안내 이미지</span>
                        {currentInvitation.customStyles?.subwayImage ? (
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
                      <FieldLabel htmlFor="p-info">자가용 / 주차 안내</FieldLabel>
                      <Textarea
                        id="p-info"
                        rows={3}
                        placeholder="예: 예식장 건물 지하 주차장 200대 가능 (하객 2시간 무료)"
                        value={currentInvitation.parkingInfo || ''}
                        onChange={(e) => updateCurrentInvitation({ parkingInfo: e.target.value })}
                      />
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <span className="text-xs font-semibold block">자가용 / 주차 안내 이미지</span>
                        {currentInvitation.customStyles?.parkingImage ? (
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
                        <FieldLabel htmlFor="shuttle-info">셔틀버스 안내</FieldLabel>
                        <Textarea
                          id="shuttle-info"
                          placeholder="셔틀버스 탑승 위치, 시간 등을 안내해주세요"
                          rows={3}
                          value={currentInvitation?.customStyles?.shuttleInfo || ''}
                          onChange={(e) => updateCustomStyle('shuttleInfo', e.target.value)}
                        />
                      </Field>
                    )}
                  </FieldGroup>
                </CardContent>
              </Card>

              {/* Section Insert Images Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">섹션 사이 사진 삽입</CardTitle>
                  <CardDescription>각 섹션 아래에 원하는 사진을 추가합니다. 사진은 가로 꽉 차게 배치됩니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const sectionLabelsForImages: Record<string, string> = {
                      hero: '메인 (Hero)', sequence: '식순 안내', gallery: '사진첩',
                      calendar: '소중한 날 (달력)', location: '식장 위치', contact: '연락처',
                      account: '마음 전하실 곳', rsvp: '참석 의사 알리기', guestbook: '방명록'
                    }
                    const sectionImages: Record<string, { url: string; caption?: string }[]> = currentInvitation?.customStyles?.sectionImages || {}
                    const allSections = Array.from(new Set(['hero', ...(currentInvitation?.customStyles?.sectionOrder || ['sequence', 'gallery', 'calendar', 'location', 'contact', 'account', 'rsvp', 'guestbook'])]))

                    const updateSectionImages = (sectionId: string, images: { url: string; caption?: string }[]) => {
                      updateCurrentInvitation({
                        customStyles: {
                          ...(currentInvitation?.customStyles || {}),
                          sectionImages: {
                            ...sectionImages,
                            [sectionId]: images
                          }
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
                                    toast.success('사진이 추가되었습니다.')
                                  } catch (err) {
                                    toast.error('사진 업로드에 실패했습니다.')
                                  }
                                  e.target.value = ''
                                }}
                              />
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-dashed border-muted-foreground/40 hover:border-primary hover:text-primary transition-colors cursor-pointer">
                                <Image className="h-3 w-3" />
                                사진 추가
                              </span>
                            </label>
                          </div>
                          {images.length > 0 && (
                            <div className="space-y-2">
                              {images.map((img, imgIdx) => (
                                <div key={imgIdx} className="flex items-center gap-2 bg-muted/30 rounded p-2">
                                  <img src={img.url} alt={`preview ${imgIdx}`} className="w-12 h-12 object-cover rounded shrink-0 border" />
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
                                    variant="ghost"
                                    size="icon"
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
            </TabsContent>

            {/* TAB: Features Settings */}
            <TabsContent value="features" className="mt-6 space-y-4">
              {/* RSVP & Guestbook & BGM */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">부가 기능 제어</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* BGM Selection */}
                  <Field>
                    <FieldLabel>배경 음악 (BGM)</FieldLabel>
                    <div className="flex gap-2">
                      <Select
                        value={currentInvitation.bgmId || 'none'}
                        onValueChange={(val) => updateCurrentInvitation({ bgmId: val === 'none' ? null : val })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="BGM 없음" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">음악 없음 (None)</SelectItem>
                          {bgms.map((bgm) => (
                            <SelectItem key={bgm.id} value={bgm.id}>
                              {bgm.name} - {bgm.artist} ({bgm.duration})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {currentInvitation.bgmId && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const selectedBgm = bgms.find(b => b.id === currentInvitation.bgmId)
                            if (selectedBgm) handlePlayBgm(selectedBgm.url)
                          }}
                        >
                          {playingBgmUrl ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </Field>

                  <Separator />

                  {/* Guestbook Option */}
                  <Field>
                    <FieldLabel>방명록 타입</FieldLabel>
                    <Select
                      value={currentInvitation.guestbookType || 'text'}
                      onValueChange={(val: any) => updateCurrentInvitation({ guestbookType: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">텍스트 방명록</SelectItem>
                        <SelectItem value="none">방명록 미노출</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Separator />

                  {/* RSVP Option Toggles */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">RSVP (참석 의사 수집)</p>
                        <p className="text-xs text-muted-foreground">게스트의 참석여부 피드백 버튼을 활성화합니다.</p>
                      </div>
                      <Switch
                        checked={currentInvitation.rsvpEnabled || false}
                        onCheckedChange={(checked) => updateCurrentInvitation({ rsvpEnabled: checked })}
                      />
                    </div>

                    {currentInvitation.rsvpEnabled && (
                      <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-4 pl-6">
                        {/* 식사 여부 조사 */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-xs">식사 여부 조사</p>
                              <p className="text-[10px] text-muted-foreground">하객들의 식사 희망 조사 및 식사 종류(한식/양식 등)를 선택할 수 있게 합니다.</p>
                            </div>
                            <Switch
                              checked={currentInvitation.customStyles?.rsvpMealSurvey ?? (currentInvitation.rsvpMealEnabled !== false)}
                              onCheckedChange={(checked) => {
                                updateCustomStyle('rsvpMealSurvey', checked)
                                updateCurrentInvitation({ rsvpMealEnabled: checked })
                              }}
                            />
                          </div>

                          {(currentInvitation.customStyles?.rsvpMealSurvey ?? (currentInvitation.rsvpMealEnabled !== false)) && (
                            <div className="space-y-2 mt-2 pt-2 border-t border-border/40 pl-2">
                              <p className="text-[11px] font-medium text-muted-foreground">식사 종류 리스트 (엔터로 추가)</p>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {(currentInvitation.customStyles?.rsvpMealOptions || ['한식', '양식']).map((opt: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center gap-1 bg-background border border-border text-foreground text-[10px] px-2 py-0.5 rounded-md">
                                    {opt}
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive text-[12px] font-bold ml-1"
                                      onClick={() => {
                                        const currentOpts = currentInvitation.customStyles?.rsvpMealOptions || ['한식', '양식'];
                                        const updated = currentOpts.filter((_: any, i: number) => i !== idx);
                                        updateCustomStyle('rsvpMealOptions', updated);
                                      }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  id="new-meal-opt"
                                  placeholder="새 종류 입력 후 추가"
                                  className="h-8 text-xs flex-1"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const input = e.currentTarget;
                                      const val = input.value.trim();
                                      if (val) {
                                        const currentOpts = currentInvitation.customStyles?.rsvpMealOptions || ['한식', '양식'];
                                        if (!currentOpts.includes(val)) {
                                          updateCustomStyle('rsvpMealOptions', [...currentOpts, val]);
                                        }
                                        input.value = '';
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs px-3"
                                  onClick={() => {
                                    const input = document.getElementById('new-meal-opt') as HTMLInputElement;
                                    const val = input?.value.trim();
                                    if (val) {
                                      const currentOpts = currentInvitation.customStyles?.rsvpMealOptions || ['한식', '양식'];
                                      if (!currentOpts.includes(val)) {
                                        updateCustomStyle('rsvpMealOptions', [...currentOpts, val]);
                                      }
                                      if (input) input.value = '';
                                    }
                                  }}
                                >
                                  추가
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 셔틀 운영 조사 */}
                        <div className="space-y-3 border-t border-border/50 pt-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-xs">셔틀 운영 조사</p>
                              <p className="text-[10px] text-muted-foreground">하객들의 셔틀 이용 여부를 수집하고 운행 안내를 제공합니다.</p>
                            </div>
                            <Switch
                              checked={currentInvitation.customStyles?.rsvpShuttleSurvey || false}
                              onCheckedChange={(checked) => updateCustomStyle('rsvpShuttleSurvey', checked)}
                            />
                          </div>

                          {currentInvitation.customStyles?.rsvpShuttleSurvey && (
                            <div className="space-y-1.5 mt-2 pt-2 border-t border-border/40 pl-2">
                              <label htmlFor="rsvp-shuttle-info" className="text-[11px] font-medium text-muted-foreground block">
                                셔틀 운영 안내 텍스트
                              </label>
                              <Textarea
                                id="rsvp-shuttle-info"
                                placeholder="예: 예식일 당일 강남역 1번 출구에서 10분 간격으로 셔틀버스가 운행됩니다."
                                value={currentInvitation.customStyles?.rsvpShuttleInfo || ''}
                                onChange={(e) => updateCustomStyle('rsvpShuttleInfo', e.target.value)}
                                className="text-xs min-h-[60px]"
                              />
                            </div>
                          )}
                        </div>

                        {/* 축하 메세지 작성 */}
                        <div className="flex items-center justify-between border-t border-border/50 pt-3">
                          <div>
                            <p className="font-medium text-xs">축하 메세지 작성</p>
                            <p className="text-[10px] text-muted-foreground">참석여부 회신 시 축하 한마디 메시지 수집을 함께 활성화합니다.</p>
                          </div>
                          <Switch
                            checked={currentInvitation.customStyles?.rsvpMessageSurvey ?? (currentInvitation.rsvpCommentEnabled !== false)}
                            onCheckedChange={(checked) => {
                              updateCustomStyle('rsvpMessageSurvey', checked)
                              updateCurrentInvitation({ rsvpCommentEnabled: checked })
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Calendar Detail Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">달력 상세 설정</CardTitle>
                  <CardDescription>달력의 디데이 표시 및 예식일 강조 디자인을 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* D-Day Toggle */}
                  <div className="flex items-center justify-between pb-4 border-b">
                    <div>
                      <p className="font-medium text-sm">달력 디데이 (D-Day) 표시</p>
                      <p className="text-xs text-muted-foreground">
                        달력 섹션 제목 아래에 결혼일자까지 남은 일수(예: D-30)를 표시합니다.
                      </p>
                    </div>
                    <Switch
                      checked={currentInvitation.customStyles?.ddayEnabled ?? false}
                      onCheckedChange={(checked) => updateCustomStyle('ddayEnabled', checked)}
                    />
                  </div>

                  {/* Wedding Date Highlight Shape */}
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-sm">예식일 강조 표시 모양</p>
                      <p className="text-xs text-muted-foreground">달력에서 결혼식 날짜를 강조할 도형을 선택합니다.</p>
                    </div>
                    <RadioGroup
                      value={currentInvitation.customStyles?.calendarDayShape || 'circle'}
                      onValueChange={(val) => updateCustomStyle('calendarDayShape', val)}
                      className="grid grid-cols-3 gap-2"
                    >
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="circle" id="shape-circle" />
                        <Label htmlFor="shape-circle" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                          <div className="h-4 w-4 rounded-full bg-primary/20 border border-primary" />
                          동그라미
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="heart" id="shape-heart" />
                        <Label htmlFor="shape-heart" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                          <span className="text-primary text-sm leading-none">♥</span>
                          하트
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="custom" id="shape-custom" />
                        <Label htmlFor="shape-custom" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          직접 업로드
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Custom Shape Upload */}
                  {currentInvitation.customStyles?.calendarDayShape === 'custom' && (
                    <div className="space-y-2 pt-2 border-t">
                      <span className="text-xs font-semibold block">강조 이미지 업로드 (PNG/SVG 권장)</span>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center overflow-hidden">
                          {currentInvitation.customStyles?.calendarDayCustomShapeUrl ? (
                            <img src={currentInvitation.customStyles.calendarDayCustomShapeUrl} className="h-full w-full object-contain" />
                          ) : (
                            <Image className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs"
                            onClick={() => calendarShapeInputRef.current?.click()}
                            disabled={isUploadingShape}
                          >
                            {isUploadingShape ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                            이미지 추가
                          </Button>
                          <input 
                            type="file" 
                            ref={calendarShapeInputRef} 
                            onChange={handleCalendarShapeUpload} 
                            accept="image/*" 
                            className="hidden" 
                            disabled={isUploadingShape}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Highlight Date Text Color */}
                  <div className="space-y-2 pt-2 border-t">
                    <div>
                      <p className="font-medium text-sm">강조일자 텍스트 색상</p>
                      <p className="text-xs text-muted-foreground">강조 도형 위의 날짜 숫자 텍스트 색상을 설정합니다.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={currentInvitation.customStyles?.calendarDayTextColor || '#ffffff'}
                        onChange={(e) => updateCustomStyle('calendarDayTextColor', e.target.value)}
                        className="h-8 w-14 rounded border cursor-pointer p-0 bg-transparent"
                      />
                      <span className="text-xs font-mono">{currentInvitation.customStyles?.calendarDayTextColor || '#ffffff'}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => updateCustomStyle('calendarDayTextColor', '#ffffff')}
                      >
                        기본값(흰색) 복원
                      </Button>
                    </div>
                  </div>

                  {/* Custom Shape SVG Color Picker */}
                  {currentInvitation.customStyles?.calendarDayShape === 'custom' && isCustomSvg && (
                    <div className="space-y-2 pt-2 border-t">
                      <div>
                        <p className="font-medium text-sm">업로드된 SVG 강조 이미지 색상</p>
                        <p className="text-xs text-muted-foreground">업로드한 SVG 이미지의 색상을 변경합니다. (기본값: 청첩장 포인트 색상)</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={currentInvitation.customStyles?.calendarDaySvgColor || defaultAccentColor}
                          onChange={(e) => updateCustomStyle('calendarDaySvgColor', e.target.value)}
                          className="h-8 w-14 rounded border cursor-pointer p-0 bg-transparent"
                        />
                        <span className="text-xs font-mono">{currentInvitation.customStyles?.calendarDaySvgColor || defaultAccentColor}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() => updateCustomStyle('calendarDaySvgColor', defaultAccentColor)}
                        >
                          기본 포인트색상 복원
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Greeting Icon Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">초대 인사말 아이콘 설정</CardTitle>
                  <CardDescription>초대 인사말 위의 아이콘 모양과 디자인을 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Greeting Icon Shape Selector */}
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-sm">아이콘 표시 모양</p>
                      <p className="text-xs text-muted-foreground">인사말 위에 노출할 아이콘 모양을 선택합니다.</p>
                    </div>
                    <RadioGroup
                      value={currentInvitation.customStyles?.greetingIconShape || 'heart'}
                      onValueChange={(val) => updateCustomStyle('greetingIconShape', val)}
                      className="grid grid-cols-4 gap-2"
                    >
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="heart" id="icon-heart" />
                        <Label htmlFor="icon-heart" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                          <span className="text-primary text-sm leading-none">♥</span>
                          하트
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="circle" id="icon-circle" />
                        <Label htmlFor="icon-circle" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                          <div className="h-3.5 w-3.5 rounded-full border border-primary" />
                          동그라미
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="star" id="icon-star" />
                        <Label htmlFor="icon-star" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                          <span className="text-primary text-sm leading-none">★</span>
                          별
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="custom" id="icon-custom" />
                        <Label htmlFor="icon-custom" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          직접 업로드
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Custom Greeting Icon Upload */}
                  {currentInvitation.customStyles?.greetingIconShape === 'custom' && (
                    <div className="space-y-2 pt-2 border-t">
                      <span className="text-xs font-semibold block">커스텀 아이콘 업로드 (PNG/SVG 권장)</span>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center overflow-hidden">
                          {currentInvitation.customStyles?.greetingIconCustomUrl ? (
                            <img src={currentInvitation.customStyles.greetingIconCustomUrl} className="h-full w-full object-contain" />
                          ) : (
                            <Image className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs"
                            onClick={() => greetingIconInputRef.current?.click()}
                            disabled={isUploadingGreetingIcon}
                          >
                            {isUploadingGreetingIcon ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                            이미지 추가
                          </Button>
                          <input 
                            type="file" 
                            ref={greetingIconInputRef} 
                            onChange={handleGreetingIconUpload} 
                            accept="image/*" 
                            className="hidden" 
                            disabled={isUploadingGreetingIcon}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Greeting Icon Color */}
                  <div className="space-y-2 pt-2 border-t">
                    <div>
                      <p className="font-medium text-sm">아이콘 색상 설정</p>
                      <p className="text-xs text-muted-foreground">아이콘의 렌더링 색상을 지정합니다. (직접 업로드한 SVG에도 적용됩니다)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={currentInvitation.customStyles?.greetingIconColor || defaultAccentColor}
                        onChange={(e) => updateCustomStyle('greetingIconColor', e.target.value)}
                        className="h-8 w-14 rounded border cursor-pointer p-0 bg-transparent"
                      />
                      <span className="text-xs font-mono">{currentInvitation.customStyles?.greetingIconColor || defaultAccentColor}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => updateCustomStyle('greetingIconColor', defaultAccentColor)}
                      >
                        기본 포인트색상 복원
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Kakao Share */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">카카오 공유 메시지 설정</CardTitle>
                  <CardDescription>카카오톡 링크 공유 시 표시될 정보를 등록합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-1">
                        <FieldLabel>공유 썸네일 이미지</FieldLabel>
                        <div className="relative aspect-square w-full rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                          {currentInvitation.kakaoThumbnail ? (
                            <>
                              <img src={currentInvitation.kakaoThumbnail} alt="Kakao" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => updateCurrentInvitation({ kakaoThumbnail: null })}
                                className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <Button variant="ghost" size="sm" type="button" onClick={() => kakaoImageInputRef.current?.click()} disabled={isUploadingKakao}>
                              {isUploadingKakao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            </Button>
                          )}
                          <input 
                            type="file" 
                            ref={kakaoImageInputRef} 
                            onChange={handleKakaoUpload} 
                            accept="image/*" 
                            className="hidden" 
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2 space-y-4">
                        <Field>
                          <FieldLabel htmlFor="k-title">공유 제목</FieldLabel>
                          <Input
                            id="k-title"
                            placeholder="예: 철수 ❤️ 영희 결혼합니다!"
                            value={currentInvitation.kakaoTitle || ''}
                            onChange={(e) => updateCurrentInvitation({ kakaoTitle: e.target.value })}
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="k-desc">공유 부제목/설명</FieldLabel>
                          <Input
                            id="k-desc"
                            placeholder="예: 2026년 10월 24일 오후 12시"
                            value={currentInvitation.kakaoDescription || ''}
                            onChange={(e) => updateCurrentInvitation({ kakaoDescription: e.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>

              {/* Accounts */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">축의금 송금 계좌 관리</CardTitle>
                    <CardDescription>가족 및 혼주의 계좌번호를 표시합니다.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => {
                    setEditingAccountId(null)
                    setNewAccount({ bank: '', accountNumber: '', accountHolder: '', relation: 'groom' })
                    setIsAccountDialogOpen(true)
                  }}>
                    <Plus className="h-4 w-4 mr-1" />
                    계좌 추가
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* Account Layout Toggle Selector */}
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <p className="text-sm font-medium">계좌 노출 레이아웃</p>
                      <p className="text-xs text-muted-foreground">모바일 청첩장에서 계좌 목록의 노출 열 개수 및 정렬을 설정합니다.</p>
                    </div>
                    <Select
                      value={currentInvitation.customStyles?.accountLayout || '1col'}
                      onValueChange={(val) => updateCustomStyle('accountLayout', val)}
                    >
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1col">1열 배치 (세로형)</SelectItem>
                        <SelectItem value="2col">2열 배치 (신랑/신부)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    {(currentInvitation.bankAccounts || []).map((acc) => (
                      <div key={acc.id} className="flex justify-between items-center border border-border rounded-lg p-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {acc.relation === 'groom' ? '신랑' : 
                             acc.relation === 'bride' ? '신부' : 
                             acc.relation === 'groomParent' ? '신랑 혼주' : '신부 혼주'}
                            {' · '}
                            {acc.bank} {acc.accountNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">예금주: {acc.accountHolder}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setEditingAccountId(acc.id)
                              setNewAccount({
                                bank: acc.bank,
                                accountNumber: acc.accountNumber,
                                accountHolder: acc.accountHolder,
                                relation: acc.relation
                              })
                              setIsAccountDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteAccount(acc.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(currentInvitation.bankAccounts || []).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">등록된 계좌가 없습니다.</p>
                    )}
                  </div>

                  {/* Add/Edit Account Dialog */}
                  <Dialog open={isAccountDialogOpen} onOpenChange={(open) => {
                    setIsAccountDialogOpen(open)
                    if (!open) {
                      setEditingAccountId(null)
                      setNewAccount({ bank: '', accountNumber: '', accountHolder: '', relation: 'groom' })
                    }
                  }}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingAccountId ? '송금 계좌 수정' : '송금 계좌 추가'}</DialogTitle>
                      </DialogHeader>
                      <FieldGroup className="mt-4">
                        <Field>
                          <FieldLabel>관계</FieldLabel>
                          <Select 
                            value={newAccount.relation} 
                            onValueChange={(val: any) => setNewAccount({ ...newAccount, relation: val })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="groom">신랑</SelectItem>
                              <SelectItem value="bride">신부</SelectItem>
                              <SelectItem value="groomParent">신랑 혼주</SelectItem>
                              <SelectItem value="brideParent">신부 혼주</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <div className="grid gap-2 grid-cols-2">
                          <Field>
                            <FieldLabel>은행명</FieldLabel>
                            <Input placeholder="예: 신한은행" value={newAccount.bank} onChange={e => setNewAccount({...newAccount, bank: e.target.value})} />
                          </Field>
                          <Field>
                            <FieldLabel>예금주</FieldLabel>
                            <Input placeholder="예: 홍길동" value={newAccount.accountHolder} onChange={e => setNewAccount({...newAccount, accountHolder: e.target.value})} />
                          </Field>
                        </div>
                        <Field>
                          <FieldLabel>계좌번호</FieldLabel>
                          <Input placeholder="하이픈(-) 제외 숫자만" value={newAccount.accountNumber} onChange={e => setNewAccount({...newAccount, accountNumber: e.target.value})} />
                        </Field>
                      </FieldGroup>
                      <Button className="w-full text-white" onClick={handleAddAccount}>
                        저장하기
                      </Button>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Contacts */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">축하 연락처 관리</CardTitle>
                    <CardDescription>하객들이 모바일에서 바로 통화할 수 있는 전화번호 목록입니다.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setIsContactDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    연락처 추가
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(currentInvitation.contacts || []).map((con) => (
                      <div key={con.id} className="flex justify-between items-center border border-border rounded-lg p-3">
                        <div>
                          <p className="text-sm font-semibold">{con.name} ({con.relation})</p>
                          <p className="text-xs text-muted-foreground">{con.phone}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteContact(con.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {(currentInvitation.contacts || []).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">등록된 연락처가 없습니다.</p>
                    )}
                  </div>

                  {/* Add Contact Dialog */}
                  <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>연락처 추가</DialogTitle>
                      </DialogHeader>
                      <FieldGroup className="mt-4">
                        <Field>
                          <FieldLabel>이름</FieldLabel>
                          <Input placeholder="예: 신랑 홍길동" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                        </Field>
                        <Field>
                          <FieldLabel>관계</FieldLabel>
                          <Select 
                            value={newContact.relation} 
                            onValueChange={(val) => setNewContact({ ...newContact, relation: val })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="신랑">신랑</SelectItem>
                              <SelectItem value="신부">신부</SelectItem>
                              <SelectItem value="신랑 아버지">신랑 아버님</SelectItem>
                              <SelectItem value="신랑 어머니">신랑 어머님</SelectItem>
                              <SelectItem value="신부 아버님">신부 아버님</SelectItem>
                              <SelectItem value="신부 어머님">신부 어머님</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel>전화번호</FieldLabel>
                          <Input placeholder="예: 010-1234-5678" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                        </Field>
                      </FieldGroup>
                      <Button className="w-full text-white" onClick={handleAddContact}>
                        저장하기
                      </Button>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Design Custom Overrides */}
            <TabsContent value="design" className="mt-6 space-y-4">
              {/* Theme selection overrides */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">디자인 테마 선택</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field className="sm:col-span-1">
                      <FieldLabel>기본 테마</FieldLabel>
                      <Select
                        value={currentInvitation.themeId}
                        onValueChange={(val) => {
                          const newTheme = themes.find(t => t.id === val) || sampleThemes.find(t => t.id === val) || sampleThemes[0]
                          updateCurrentInvitation({ 
                            themeId: val,
                            colorSet: newTheme.colorSets?.[0]?.id || 'default',
                            fontSet: newTheme.fontSets?.[0]?.id || 'default'
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {themes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field className="sm:col-span-1">
                      <FieldLabel>색상 세트 (Preset)</FieldLabel>
                      <Select
                        value={currentInvitation.colorSet || 'default'}
                        onValueChange={(val) => updateCurrentInvitation({ colorSet: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">테마 기본값</SelectItem>
                          {activeTheme?.colorSets?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field className="sm:col-span-1">
                      <FieldLabel>폰트 세트 (Preset)</FieldLabel>
                      <Select
                        value={currentInvitation.fontSet || 'default'}
                        onValueChange={(val) => updateCurrentInvitation({ fontSet: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">테마 기본값</SelectItem>
                          {activeTheme?.fontSets?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {/* 직접 설정하기 Toggle */}
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="admin-custom-colors-toggle" className="text-sm font-medium">직접 설정하기 (커스텀 듀오톤)</Label>
                        <p className="text-xs text-muted-foreground">테마 프리셋 대신 내가 원하는 두 가지 색상 조합으로 청첩장을 꾸밉니다.</p>
                      </div>
                      <Switch 
                        id="admin-custom-colors-toggle"
                        checked={currentInvitation.customStyles?.customColorsEnabled || false}
                        onCheckedChange={(checked) => {
                          updateCurrentInvitation({
                            ...currentInvitation,
                            customStyles: {
                              ...(currentInvitation.customStyles || {}),
                              customColorsEnabled: checked,
                              duotoneEnabled: checked
                            }
                          })
                        }}
                      />
                    </div>

                    {currentInvitation.customStyles?.customColorsEnabled && (
                      <div className="grid gap-4 sm:grid-cols-2 pt-2 animate-in fade-in duration-200">
                        <div className="space-y-2">
                          <Label className="text-xs">배경 색상 (Color 1 - 밝은색 권장)</Label>
                          <div className="flex gap-2">
                            <Input 
                              type="color" 
                              className="w-10 h-10 p-1 cursor-pointer border" 
                              value={currentInvitation.customStyles?.customBgColor || '#CCECFF'} 
                              onChange={(e) => {
                                updateCurrentInvitation({
                                  ...currentInvitation,
                                  customStyles: {
                                    ...(currentInvitation.customStyles || {}),
                                    customBgColor: e.target.value
                                  }
                                })
                              }}
                            />
                            <Input 
                              className="flex-1 uppercase font-mono text-sm" 
                              value={currentInvitation.customStyles?.customBgColor || '#CCECFF'} 
                              onChange={(e) => {
                                updateCurrentInvitation({
                                  ...currentInvitation,
                                  customStyles: {
                                    ...(currentInvitation.customStyles || {}),
                                    customBgColor: e.target.value
                                  }
                                })
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">주요 색상 (Color 2 - 어두운색 권장)</Label>
                          <div className="flex gap-2">
                            <Input 
                              type="color" 
                              className="w-10 h-10 p-1 cursor-pointer border" 
                              value={currentInvitation.customStyles?.customPrimaryColor || '#361623'} 
                              onChange={(e) => {
                                updateCurrentInvitation({
                                  ...currentInvitation,
                                  customStyles: {
                                    ...(currentInvitation.customStyles || {}),
                                    customPrimaryColor: e.target.value
                                  }
                                })
                              }}
                            />
                            <Input 
                              className="flex-1 uppercase font-mono text-sm" 
                              value={currentInvitation.customStyles?.customPrimaryColor || '#361623'} 
                              onChange={(e) => {
                                updateCurrentInvitation({
                                  ...currentInvitation,
                                  customStyles: {
                                    ...(currentInvitation.customStyles || {}),
                                    customPrimaryColor: e.target.value
                                  }
                                })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Advanced Custom Styling overrides */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">디자인 맞춤 커스터마이징 (Overrides)</CardTitle>
                  <CardDescription>배경색, 자간, 폰트, 여백 등을 개별적으로 재정의하여 맞춤 제작합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Colors */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm border-b pb-1">맞춤 색상 (Colors)</h3>
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                      <Field>
                        <FieldLabel>배경 색상</FieldLabel>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            className="w-10 h-10 p-1 rounded cursor-pointer border"
                            value={currentInvitation.customStyles?.backgroundColor || activeTheme?.styles?.backgroundColor || '#FFF8F0'} 
                            onChange={(e) => updateCustomStyle('backgroundColor', e.target.value)}
                          />
                          <Input 
                            value={currentInvitation.customStyles?.backgroundColor || ''} 
                            placeholder={activeTheme?.styles?.backgroundColor || '#FFF8F0'}
                            onChange={(e) => updateCustomStyle('backgroundColor', e.target.value || null)}
                            className="flex-1 text-xs"
                          />
                        </div>
                      </Field>

                      <Field>
                        <FieldLabel>포인트 색상 (Accent)</FieldLabel>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            className="w-10 h-10 p-1 rounded cursor-pointer border"
                            value={currentInvitation.customStyles?.primaryColor || activeTheme?.styles?.primaryColor || '#E8A87C'} 
                            onChange={(e) => updateCustomStyle('primaryColor', e.target.value)}
                          />
                          <Input 
                            value={currentInvitation.customStyles?.primaryColor || ''} 
                            placeholder={activeTheme?.styles?.primaryColor || '#E8A87C'}
                            onChange={(e) => updateCustomStyle('primaryColor', e.target.value || null)}
                            className="flex-1 text-xs"
                          />
                        </div>
                      </Field>

                      <Field>
                        <FieldLabel>본문 글자 색상</FieldLabel>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            className="w-10 h-10 p-1 rounded cursor-pointer border"
                            value={currentInvitation.customStyles?.textColor || activeTheme?.styles?.textColor || '#3A3A3A'} 
                            onChange={(e) => updateCustomStyle('textColor', e.target.value)}
                          />
                          <Input 
                            value={currentInvitation.customStyles?.textColor || ''} 
                            placeholder={activeTheme?.styles?.textColor || '#3A3A3A'}
                            onChange={(e) => updateCustomStyle('textColor', e.target.value || null)}
                            className="flex-1 text-xs"
                          />
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* Typography */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold text-sm border-b pb-1">타이포그래피 (Typography)</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>국문 서체 (Korean Font)</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.fontKr || ''}
                          onValueChange={(val) => updateCustomStyle('fontKr', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본 폰트 사용" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 서체 사용</SelectItem>
                            <SelectItem value="font-serif">기본 명조체 (Noto Serif)</SelectItem>
                            <SelectItem value="font-sans">기본 고딕체 (Pretendard)</SelectItem>
                            {customFonts.map(f => (
                              <SelectItem key={f.id} value={f.family || f.name}>
                                {f.name} ({f.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>영문 서체 (English Font)</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.fontEn || ''}
                          onValueChange={(val) => updateCustomStyle('fontEn', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본 폰트 사용" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 서체 사용</SelectItem>
                            <SelectItem value="font-serif">기본 명조체 (Playfair)</SelectItem>
                            <SelectItem value="font-sans">기본 고딕체 (Inter)</SelectItem>
                            {customFonts.map(f => (
                              <SelectItem key={f.id} value={f.family || f.name}>
                                {f.name} ({f.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                      <Field>
                        <FieldLabel>기본 글꼴 크기</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.fontSize || ''}
                          onValueChange={(val) => updateCustomStyle('fontSize', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본값 (16px)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 16px</SelectItem>
                            <SelectItem value="14px">작게 (14px)</SelectItem>
                            <SelectItem value="15px">약간 작게 (15px)</SelectItem>
                            <SelectItem value="16px">보통 (16px)</SelectItem>
                            <SelectItem value="17px">약간 크게 (17px)</SelectItem>
                            <SelectItem value="18px">크게 (18px)</SelectItem>
                            <SelectItem value="20px">매우 크게 (20px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>자간 설정 (Letter Spacing)</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.letterSpacing || ''}
                          onValueChange={(val) => updateCustomStyle('letterSpacing', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본값 (-0.02em)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 -0.02em</SelectItem>
                            <SelectItem value="-0.05em">좁게 (-0.05em)</SelectItem>
                            <SelectItem value="-0.02em">보통 (-0.02em)</SelectItem>
                            <SelectItem value="0em">넓게 (0em)</SelectItem>
                            <SelectItem value="0.02em">매우 넓게 (0.02em)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>

                  {/* Spacing & Borders */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold text-sm border-b pb-1">레이아웃 & 여백 (Layout & Borders)</h3>
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                      <Field>
                        <FieldLabel>카드 테두리 둥글기</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.borderRadius || ''}
                          onValueChange={(val) => updateCustomStyle('borderRadius', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본값 (8px)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 8px</SelectItem>
                            <SelectItem value="0px">둥글기 없음 (0px)</SelectItem>
                            <SelectItem value="4px">약간 둥글게 (4px)</SelectItem>
                            <SelectItem value="8px">보통 (8px)</SelectItem>
                            <SelectItem value="12px">둥글게 (12px)</SelectItem>
                            <SelectItem value="20px">매우 둥글게 (20px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>섹션 위아래 여백</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.sectionSpacing || ''}
                          onValueChange={(val) => updateCustomStyle('sectionSpacing', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본값 (py-16)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 py-16</SelectItem>
                            <SelectItem value="py-8">좁게 (py-8)</SelectItem>
                            <SelectItem value="py-12">약간 좁게 (py-12)</SelectItem>
                            <SelectItem value="py-16">보통 (py-16)</SelectItem>
                            <SelectItem value="py-20">넓게 (py-20)</SelectItem>
                            <SelectItem value="py-24">매우 넓게 (py-24)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>카드 배경 스타일</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.cardBg || ''}
                          onValueChange={(val) => updateCustomStyle('cardBg', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본값 (bg-white/40)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 반투명 (40%)</SelectItem>
                            <SelectItem value="bg-white/10">매우 얇은 반투명 (10%)</SelectItem>
                            <SelectItem value="bg-white/40">반투명 (40%)</SelectItem>
                            <SelectItem value="bg-white/80">진한 반투명 (80%)</SelectItem>
                            <SelectItem value="bg-white">불투명 흰색 (100%)</SelectItem>
                            <SelectItem value="bg-transparent">배경 없음 (투명)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>구분선 디자인</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.dividerType || ''}
                          onValueChange={(val) => updateCustomStyle('dividerType', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본값 (heart)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 heart형</SelectItem>
                            <SelectItem value="none">구분선 없음</SelectItem>
                            <SelectItem value="line">실선형</SelectItem>
                            <SelectItem value="heart">하트 심볼</SelectItem>
                            <SelectItem value="flower">플라워 심볼</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>대문(Hero) 텍스트 정렬</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.heroStyle || ''}
                          onValueChange={(val) => updateCustomStyle('heroStyle', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본값 (center)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본 중앙정렬</SelectItem>
                            <SelectItem value="center">중앙 정렬 (Center)</SelectItem>
                            <SelectItem value="left">좌측 정렬 (Left)</SelectItem>
                            <SelectItem value="right">우측 정렬 (Right)</SelectItem>
                            <SelectItem value="minimal">심플 미니멀</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>대문 이름 연결 기호 (&amp;)</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.heroConnector || ''}
                          onValueChange={(val) => updateCustomStyle('heroConnector', val || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="기본값 (&amp;)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_clear">기본값 (&amp;)</SelectItem>
                            <SelectItem value="&amp;">&amp; (엠퍼샌드)</SelectItem>
                            <SelectItem value="♥">♥ (하트)</SelectItem>
                            <SelectItem value="and">and (소문자)</SelectItem>
                            <SelectItem value="AND">AND (대문자)</SelectItem>
                            <SelectItem value="with">with</SelectItem>
                            <SelectItem value="none">없음 (기호 제외)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>

                  {/* Hero Subtitle Settings */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold text-sm border-b pb-1">히어로 서브타이틀 설정 (대문 이미지 문구)</h3>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                      <Field>
                        <FieldLabel>타이틀 문구</FieldLabel>
                        <Input 
                          value={currentInvitation.customStyles?.heroSubtitleText ?? 'save the date'} 
                          placeholder="save the date" 
                          onChange={(e) => updateCustomStyle('heroSubtitleText', e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>폰트 선택</FieldLabel>
                        <Select
                          value={currentInvitation.customStyles?.heroSubtitleFont || 'font-serif'}
                          onValueChange={(val) => updateCustomStyle('heroSubtitleFont', val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="font-serif">기본 명조체 (Playfair / Lora)</SelectItem>
                            <SelectItem value="font-sans">기본 고딕체 (Inter)</SelectItem>
                            {customFonts.map((font: any) => (
                              <SelectItem key={font.id} value={font.family}>{font.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>폰트 크기 (px)</FieldLabel>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            min="10" 
                            max="60" 
                            value={currentInvitation.customStyles?.heroSubtitleSize ?? 20} 
                            onChange={(e) => updateCustomStyle('heroSubtitleSize', parseInt(e.target.value) || 20)}
                          />
                          <span className="text-xs text-muted-foreground">px</span>
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* Section Ordering */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold text-sm border-b pb-1">노출 섹션 순서 재정렬</h3>
                    <p className="text-xs text-muted-foreground">위/아래 버튼을 클릭하여 모바일 화면 상에 노출될 섹션의 순서를 자유롭게 조정합니다.</p>
                    <div className="space-y-2 max-w-md bg-muted/40 border rounded-lg p-4">
                      {(() => {
                        const defaultOrder = ['hero', 'greeting', 'sequence', 'gallery', 'calendar', 'location', 'contact', 'account', 'rsvp', 'guestbook']
                        const rawOrder = currentInvitation.customStyles?.sectionOrder || activeTheme?.styles?.sectionOrder || defaultOrder
                        const sectionOrder = rawOrder.includes('sequence')
                          ? rawOrder
                          : (() => {
                              const idx = rawOrder.indexOf('greeting')
                              const newOrder = [...rawOrder]
                              newOrder.splice(idx !== -1 ? idx + 1 : 2, 0, 'sequence')
                              return newOrder
                            })()
                        
                        return (sectionOrder as string[]).map((section: string, idx: number) => (
                          <div key={section} className="flex justify-between items-center bg-background border rounded px-3 py-2 text-xs shadow-sm">
                            <span className="font-medium">{idx + 1}. {sectionLabels[section] || section}</span>
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-6 w-6" 
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveSection(idx, 'up')}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-6 w-6" 
                                type="button"
                                disabled={idx === sectionOrder.length - 1}
                                onClick={() => handleMoveSection(idx, 'down')}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 대문 예식정보 및 인사말 세부 설정 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">대문 예식정보 & 인사말 스타일 설정</CardTitle>
                  <CardDescription>대문 이미지 하단의 예식 정보(이름, 시간, 장소) 서체와 크기를 조정하고, 인사말 섹션 내 혼주 이름 스타일을 변경합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">대문 예식정보 스타일</h4>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field>
                        <FieldLabel>서체 선택</FieldLabel>
                        <Select
                          value={currentInvitation?.customStyles?.heroInfoFont || 'font-sans'}
                          onValueChange={(val) => {
                            updateCurrentInvitation({
                              customStyles: {
                                ...(currentInvitation?.customStyles || {}),
                                heroInfoFont: val
                              }
                            })
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="font-serif">기본 명조체</SelectItem>
                            <SelectItem value="font-sans">기본 고딕체</SelectItem>
                            {customFonts.map((font: any) => (
                              <SelectItem key={font.id} value={font.family}>{font.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>신랑 신부 이름 크기 (px)</FieldLabel>
                        <Input 
                          type="number" 
                          min="10" 
                          max="40" 
                          value={currentInvitation?.customStyles?.heroInfoGroomBrideSize ?? 14} 
                          onChange={(e) => {
                            updateCurrentInvitation({
                              customStyles: {
                                ...(currentInvitation?.customStyles || {}),
                                heroInfoGroomBrideSize: parseInt(e.target.value) || 14
                              }
                            })
                          }}
                          className="h-9"
                        />
                      </Field>

                      <Field>
                        <FieldLabel>예식 일시/장소 크기 (px)</FieldLabel>
                        <Input 
                          type="number" 
                          min="8" 
                          max="30" 
                          value={currentInvitation?.customStyles?.heroInfoDetailsSize ?? 10} 
                          onChange={(e) => {
                            updateCurrentInvitation({
                              customStyles: {
                                ...(currentInvitation?.customStyles || {}),
                                heroInfoDetailsSize: parseInt(e.target.value) || 10
                              }
                            })
                          }}
                          className="h-9"
                        />
                      </Field>
                    </div>
                  </div>


                </CardContent>
              </Card>

              {/* Section Header Customization */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">섹션 타이틀 상세 설정</CardTitle>
                  <CardDescription>각 섹션별 영어/한국어 제목의 노출, 문구, 서체·크기·스타일을 변경합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field>
                    <FieldLabel>편집할 섹션 선택</FieldLabel>
                    <Select
                      value={activeHeaderSection}
                      onValueChange={(val) => setActiveHeaderSection(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sequence">식순 안내 (Sequence)</SelectItem>
                        <SelectItem value="gallery">사진첩 (Gallery)</SelectItem>
                        <SelectItem value="calendar">소중한 날 (Calendar)</SelectItem>
                        <SelectItem value="location">식장 위치 (Location)</SelectItem>
                        <SelectItem value="contact">연락처 (Contact)</SelectItem>
                        <SelectItem value="account">마음 전하실 곳 (Account)</SelectItem>
                        <SelectItem value="rsvp">참석 의사 알리기 (RSVP)</SelectItem>
                        <SelectItem value="guestbook">방명록 (Guestbook)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {(() => {
                    const sectionId = activeHeaderSection
                    const headers = currentInvitation?.customStyles?.sectionHeaders || {}
                    const settings = headers[sectionId] || {}

                    const isShow = settings.show ?? true
                    const titleEnDefault: Record<string, string> = {
                      sequence: 'WEDDING ORDER', gallery: 'Gallery', calendar: 'Calendar',
                      location: 'Location', contact: 'Contact', account: 'Account',
                      rsvp: 'RSVP', guestbook: 'Guestbook'
                    }
                    const titleKrDefault: Record<string, string> = {
                      sequence: '식순 안내', gallery: '사진첩', calendar: '소중한 날',
                      location: '식장 위치', contact: '연락처', account: '마음 전하실 곳',
                      rsvp: '참석 의사 알리기', guestbook: '방명록'
                    }
                    const titleEn = settings.titleEn ?? (titleEnDefault[sectionId] || '')
                    const titleKr = settings.titleKr ?? (titleKrDefault[sectionId] || '')
                    const fontEnVal = settings.fontEn || 'font-serif'
                    const fontKrVal = settings.fontKr || 'font-serif'
                    const sizeEn = settings.sizeEn ?? 20
                    const sizeKr = settings.sizeKr ?? 9
                    const italicEn = settings.italicEn ?? true
                    const italicKr = settings.italicKr ?? false
                    const boldEn = settings.boldEn ?? false
                    const boldKr = settings.boldKr ?? true
                    const colorEn = settings.colorEn || '#000000'
                    const colorKr = settings.colorKr || '#000000'

                    const updateHeaderSetting = (key: string, value: any) => {
                      updateCurrentInvitation({
                        customStyles: {
                          ...(currentInvitation?.customStyles || {}),
                          sectionHeaders: {
                            ...headers,
                            [sectionId]: { ...settings, [key]: value }
                          }
                        }
                      })
                    }

                    return (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">섹션 타이틀 노출</Label>
                          <Switch
                            checked={isShow}
                            onCheckedChange={(v) => updateHeaderSetting('show', v)}
                          />
                        </div>

                        {isShow && (
                          <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field>
                                <FieldLabel>영문 제목</FieldLabel>
                                <Input value={titleEn} onChange={(e) => updateHeaderSetting('titleEn', e.target.value)} />
                              </Field>
                              <Field>
                                <FieldLabel>국문 제목</FieldLabel>
                                <Input value={titleKr} onChange={(e) => updateHeaderSetting('titleKr', e.target.value)} />
                              </Field>
                            </div>

                            <div className="border rounded-lg p-4 space-y-4 bg-muted/5">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">영문 타이틀 스타일</p>
                              <div className="grid gap-3 sm:grid-cols-4 items-end">
                                <Field>
                                  <FieldLabel>서체</FieldLabel>
                                  <Select value={fontEnVal} onValueChange={(v) => updateHeaderSetting('fontEn', v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="font-serif">명조체 (Playfair)</SelectItem>
                                      <SelectItem value="font-sans">고딕체 (Inter)</SelectItem>
                                      {customFonts.map((f: any) => (
                                        <SelectItem key={f.id} value={f.family}>{f.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>
                                <Field>
                                  <FieldLabel>크기 (px)</FieldLabel>
                                  <Input type="number" className="h-8 text-xs" value={sizeEn}
                                    onChange={(e) => updateHeaderSetting('sizeEn', parseInt(e.target.value) || 20)} />
                                </Field>
                                <Field>
                                  <FieldLabel>글씨 색상</FieldLabel>
                                  <div className="flex items-center gap-1.5 h-8">
                                    <Input
                                      type="color"
                                      className="h-8 w-12 p-0.5 border cursor-pointer"
                                      value={colorEn}
                                      onChange={(e) => updateHeaderSetting('colorEn', e.target.value)}
                                    />
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{colorEn}</span>
                                  </div>
                                </Field>
                                <div className="flex gap-4 pb-1">
                                  <div className="flex items-center gap-1.5">
                                    <Checkbox id="admin-italic-en" checked={italicEn}
                                      onCheckedChange={(v) => updateHeaderSetting('italicEn', !!v)} />
                                    <Label htmlFor="admin-italic-en" className="text-xs">이탤릭</Label>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Checkbox id="admin-bold-en" checked={boldEn}
                                      onCheckedChange={(v) => updateHeaderSetting('boldEn', !!v)} />
                                    <Label htmlFor="admin-bold-en" className="text-xs">굵게</Label>
                                  </div>
                                </div>
                              </div>

                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2 border-t">국문 타이틀 스타일</p>
                              <div className="grid gap-3 sm:grid-cols-4 items-end">
                                <Field>
                                  <FieldLabel>서체</FieldLabel>
                                  <Select value={fontKrVal} onValueChange={(v) => updateHeaderSetting('fontKr', v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="font-serif">명조체 (Noto Serif)</SelectItem>
                                      <SelectItem value="font-sans">고딕체 (Pretendard)</SelectItem>
                                      {customFonts.map((f: any) => (
                                        <SelectItem key={f.id} value={f.family}>{f.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>
                                <Field>
                                  <FieldLabel>크기 (px)</FieldLabel>
                                  <Input type="number" className="h-8 text-xs" value={sizeKr}
                                    onChange={(e) => updateHeaderSetting('sizeKr', parseInt(e.target.value) || 9)} />
                                </Field>
                                <Field>
                                  <FieldLabel>글씨 색상</FieldLabel>
                                  <div className="flex items-center gap-1.5 h-8">
                                    <Input
                                      type="color"
                                      className="h-8 w-12 p-0.5 border cursor-pointer"
                                      value={colorKr}
                                      onChange={(e) => updateHeaderSetting('colorKr', e.target.value)}
                                    />
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{colorKr}</span>
                                  </div>
                                </Field>
                                <div className="flex gap-4 pb-1">
                                  <div className="flex items-center gap-1.5">
                                    <Checkbox id="admin-italic-kr" checked={italicKr}
                                      onCheckedChange={(v) => updateHeaderSetting('italicKr', !!v)} />
                                    <Label htmlFor="admin-italic-kr" className="text-xs">이탤릭</Label>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Checkbox id="admin-bold-kr" checked={boldKr}
                                      onCheckedChange={(v) => updateHeaderSetting('boldKr', !!v)} />
                                    <Label htmlFor="admin-bold-kr" className="text-xs">굵게</Label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel: Mobile Preview */}
        <div className="w-full lg:w-[400px] flex-shrink-0 bg-muted/20 border rounded-lg p-6 flex flex-col items-center justify-start shadow-inner overflow-hidden min-h-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 flex-shrink-0">실시간 모바일 미리보기</p>
          <div className="flex-1 w-full flex items-center justify-center min-h-0">
            <MobilePreview className="w-full" isSticky={false} />
          </div>
        </div>
      </div>
      
      {/* Audio Element */}
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}
