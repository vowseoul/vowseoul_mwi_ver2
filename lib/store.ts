import { create } from 'zustand'
import { supabase } from './supabase'

export interface WeddingInvitation {
  id: string
  groomName: string
  groomNameEn: string
  groomParentRelation: string
  brideName: string
  brideNameEn: string
  brideParentRelation: string
  weddingDate: string
  weddingTime: string
  venueName: string
  venueHall: string
  venueAddress: string
  themeId: string
  colorSet: string
  fontSet: string
  mainImage: string | null
  invitationMessage: string
  galleryImages: string[]
  galleryViewType: 'grid' | 'slide'
  trafficInfo: string
  parkingInfo: string
  rsvpEnabled: boolean
  rsvpMealEnabled?: boolean
  rsvpCommentEnabled?: boolean
  guestbookType: 'text' | 'audio' | 'none'
  bgmId: string | null
  kakaoThumbnail: string | null
  kakaoTitle: string
  kakaoDescription: string
  bankAccounts: BankAccount[]
  contacts: Contact[]
  status: 'draft' | 'paid' | 'published' | 'expired'
  createdAt: string
  publishedUrl: string | null
  customStyles?: Record<string, any>
}

export interface BankAccount {
  id: string
  bank: string
  accountNumber: string
  accountHolder: string
  relation: 'groom' | 'bride' | 'groomParent' | 'brideParent'
}

export interface Contact {
  id: string
  name: string
  phone: string
  relation: string
}

export interface Theme {
  id: string
  name: string
  thumbnail: string
  tags: string[]
  colorSets: { id: string; name: string; colors: string[] }[]
  fontSets: { id: string; name: string; fonts: string[] }[]
  layout?: string
  styles?: {
    fontSizeBase?: string
    fontSize?: string
    letterSpacing?: string
    primaryColor?: string
    backgroundColor?: string
    textColor?: string
    secondaryColor?: string
    secondaryTextColor?: string
    borderRadius?: string
    sectionSpacing?: string
    cardBg?: string
    cardShadow?: string
    dividerType?: string
    heroStyle?: string
    sectionOrder?: string[]
  }
}

export interface BGM {
  id: string
  name: string
  artist: string
  duration: string
  url: string
  isRecommended: boolean
}

export interface Order {
  id: string
  invitationId: string
  customerName: string
  groomName: string
  brideName: string
  weddingDate: string
  theme: string
  amount: number
  status: 'pending' | 'paid' | 'deployed' | 'expired' | 'refunded'
  createdAt: string
  notes: string
}

export interface FAQ {
  id: string
  question: string
  answer: string
  category?: string
  createdAt: string
}

export interface Notice {
  id: string
  title: string
  content: string
  category: string
  createdAt: string
}

// Helper to map DB record to WeddingInvitation (unpack content_data)
export function mapFromDb(dbRecord: any): WeddingInvitation {
  if (!dbRecord) return null as any
  const content = dbRecord.content_data || {}
  return {
    id: dbRecord.id,
    themeId: dbRecord.theme_version_id || 'classic-white',
    colorSet: dbRecord.customization_overrides?.colorSet || 'default',
    fontSet: dbRecord.customization_overrides?.fontSet || 'default',
    status: dbRecord.status,
    createdAt: dbRecord.created_at,
    publishedUrl: dbRecord.published_at ? `${dbRecord.public_slug}` : null,
    
    // content_data fields
    groomName: content.groomName || '',
    groomNameEn: content.groomNameEn || '',
    groomParentRelation: content.groomParentRelation || '',
    brideName: content.brideName || '',
    brideNameEn: content.brideNameEn || '',
    brideParentRelation: content.brideParentRelation || '',
    weddingDate: content.weddingDate || '',
    weddingTime: content.weddingTime || '',
    venueName: content.venueName || '',
    venueHall: content.venueHall || '',
    venueAddress: content.venueAddress || '',
    invitationMessage: content.invitationMessage || '',
    galleryImages: content.galleryImages || [],
    galleryViewType: content.galleryViewType || 'slide',
    trafficInfo: content.trafficInfo || '',
    parkingInfo: content.parkingInfo || '',
    rsvpEnabled: content.rsvpEnabled !== false,
    rsvpMealEnabled: content.rsvpMealEnabled !== false,
    rsvpCommentEnabled: content.rsvpCommentEnabled !== false,
    guestbookType: content.guestbookType || 'text',
    bgmId: content.bgmId || null,
    kakaoThumbnail: content.kakaoThumbnail || null,
    kakaoTitle: content.kakaoTitle || '',
    kakaoDescription: content.kakaoDescription || '',
    bankAccounts: content.bankAccounts || [],
    contacts: content.contacts || [],
    customStyles: content.customStyles || {},
  }
}

// Helper to map WeddingInvitation to DB record (pack content_data)
export function mapToDb(inv: any) {
  if (!inv) return null as any
  return {
    id: inv.id,
    customer_id: inv.customerId || inv.customer_id || '00000000-0000-0000-0000-000000000000',
    theme_version_id: inv.themeId || inv.theme_version_id || null,
    public_slug: inv.public_slug || inv.publicSlug || inv.id || 'slug',
    dashboard_slug: inv.dashboard_slug || `dash-${inv.public_slug || inv.id || 'slug'}`,
    dashboard_password: inv.dashboard_password || '1234',
    status: inv.status || 'draft',
    expires_at: inv.expires_at || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    block_order: inv.block_order || ["cover", "greeting", "couple-info", "event-info", "gallery", "map", "account", "rsvp", "guestbook"],
    
    // Packed JSONB fields
    customization_overrides: {
      colorSet: inv.colorSet || 'default',
      fontSet: inv.fontSet || 'default',
    },
    content_data: {
      groomName: inv.groomName || '',
      groomNameEn: inv.groomNameEn || '',
      groomParentRelation: inv.groomParentRelation || '',
      brideName: inv.brideName || '',
      brideNameEn: inv.brideNameEn || '',
      brideParentRelation: inv.brideParentRelation || '',
      weddingDate: inv.weddingDate || '',
      weddingTime: inv.weddingTime || '',
      venueName: inv.venueName || '',
      venueHall: inv.venueHall || '',
      venueAddress: inv.venueAddress || '',
      invitationMessage: inv.invitationMessage || '',
      galleryImages: inv.galleryImages || [],
      galleryViewType: inv.galleryViewType || 'slide',
      trafficInfo: inv.trafficInfo || '',
      parkingInfo: inv.parkingInfo || '',
      rsvpEnabled: inv.rsvpEnabled !== false,
      rsvpMealEnabled: inv.rsvpMealEnabled !== false,
      rsvpCommentEnabled: inv.rsvpCommentEnabled !== false,
      guestbookType: inv.guestbookType || 'text',
      bgmId: inv.bgmId || null,
      kakaoThumbnail: inv.kakaoThumbnail || null,
      kakaoTitle: inv.kakaoTitle || '',
      kakaoDescription: inv.kakaoDescription || '',
      bankAccounts: inv.bankAccounts || [],
      contacts: inv.contacts || [],
      customStyles: inv.customStyles || {},
    }
  }
}

interface AppState {
  // Data fetching
  fetchData: () => Promise<void>
  
  // Current invitation being edited
  currentInvitation: Partial<WeddingInvitation> | null
  setCurrentInvitation: (invitation: Partial<WeddingInvitation> | null) => void
  updateCurrentInvitation: (updates: Partial<WeddingInvitation>) => void
  loadInvitation: (id: string) => Promise<void>
  saveInvitation: () => Promise<string | null>
  
  // User's invitations
  invitations: WeddingInvitation[]
  setInvitations: (invitations: WeddingInvitation[]) => void
  addInvitation: (invitation: WeddingInvitation) => Promise<void>
  
  // Themes
  themes: Theme[]
  setThemes: (themes: Theme[]) => void
  
  // BGM
  bgmList: BGM[]
  setBgmList: (bgm: BGM[]) => void
  
  // Admin state
  orders: Order[]
  setOrders: (orders: Order[]) => void
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>
  
  // FAQ state
  faqs: FAQ[]
  setFaqs: (faqs: FAQ[]) => void
  addFaq: (faq: FAQ) => Promise<void>
  updateFaq: (id: string, faq: Partial<FAQ>) => Promise<void>
  deleteFaq: (id: string) => Promise<void>

  // Notice state
  notices: Notice[]
  setNotices: (notices: Notice[]) => void
  addNotice: (notice: Notice) => Promise<void>
  updateNotice: (id: string, notice: Partial<Notice>) => Promise<void>
  deleteNotice: (id: string) => Promise<void>
  
  // UI state
  editorStep: number
  setEditorStep: (step: number) => void
  activeSection: string | null
  setActiveSection: (section: string | null) => void
  
  // Auth state
  isAuthenticated: boolean
  isAdmin: boolean
  setAuth: (isAuthenticated: boolean, isAdmin: boolean) => void
  user: any | null
  setUser: (user: any | null) => void
  loadUserInvitations: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  fetchData: async () => {
    try {
      const [
        { data: faqs },
        { data: themes },
        { data: bgms },
        { data: orders }
      ] = await Promise.all([
        supabase.from('faqs').select('*'),
        supabase.from('themes').select('*'),
        supabase.from('bgms').select('*'),
        supabase.from('orders').select('*')
      ])

      let noticesList = []
      try {
        const { data: noticesData } = await supabase.from('notices').select('*')
        if (noticesData && noticesData.length > 0) {
          noticesList = noticesData
        } else {
          const localNotices = typeof window !== 'undefined' ? localStorage.getItem('vow_seoul_local_notices') : null
          if (localNotices) {
            noticesList = JSON.parse(localNotices)
          } else {
            noticesList = sampleNotices
          }
        }
      } catch (err) {
        console.warn('Querying notices table failed, checking localStorage:', err)
        const localNotices = typeof window !== 'undefined' ? localStorage.getItem('vow_seoul_local_notices') : null
        if (localNotices) {
          noticesList = JSON.parse(localNotices)
        } else {
          noticesList = sampleNotices
        }
      }

      set({
        faqs: faqs || [],
        themes: themes || [],
        bgmList: bgms || [],
        orders: orders || [],
        notices: noticesList
      })
    } catch (e) {
      console.error('Error fetching data from Supabase:', e)
    }
  },

  currentInvitation: null,
  setCurrentInvitation: (invitation) => set({ currentInvitation: invitation }),
  updateCurrentInvitation: (updates) => set((state) => ({
    currentInvitation: state.currentInvitation 
      ? { ...state.currentInvitation, ...updates }
      : updates
  })),
  loadInvitation: async (id) => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      if (data) {
        const mapped = mapFromDb(data)
        set({ currentInvitation: mapped })
      }
    } catch (e) {
      console.error('Error loading invitation from Supabase:', e)
    }
  },
  saveInvitation: async (): Promise<string | null> => {
    const state = get()
    const current = state.currentInvitation
    if (!current) return null

    try {
      let id = current.id
      const isNew = !id || id === 'new'

      if (isNew) {
        const userId = state.user?.id
        const randId = typeof window !== 'undefined' && window.crypto?.randomUUID 
          ? window.crypto.randomUUID() 
          : 'inv-' + Math.random().toString(36).substring(2, 15)
        
        id = userId ? `${userId}__${randId}` : randId
      }

      const flatInvitation = {
        ...current,
        id,
      } as any

      const dbPayload = mapToDb(flatInvitation)

      if (isNew) {
        const { error } = await supabase.from('invitations').insert(dbPayload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('invitations').update(dbPayload).eq('id', id)
        if (error) throw error
      }

      set((state) => {
        const updatedInvitation = { ...current, id } as WeddingInvitation
        const updatedList = isNew 
          ? [...state.invitations, updatedInvitation]
          : state.invitations.map(inv => inv.id === id ? updatedInvitation : inv)
        
        return {
          currentInvitation: updatedInvitation,
          invitations: updatedList
        }
      })

      return id || null
    } catch (e) {
      console.error('Error saving invitation to Supabase:', e)
      return null
    }
  },
  
  invitations: [],
  setInvitations: (invitations) => set({ invitations }),
  addInvitation: async (invitation) => {
    await supabase.from('invitations').insert(invitation)
    set((state) => ({
      invitations: [...state.invitations, invitation]
    }))
  },
  
  themes: [],
  setThemes: (themes) => set({ themes }),
  
  bgmList: [],
  setBgmList: (bgmList) => set({ bgmList }),
  
  orders: [],
  setOrders: (orders) => set({ orders }),
  updateOrder: async (id, updates) => {
    await supabase.from('orders').update(updates).eq('id', id)
    set((state) => ({
      orders: state.orders.map(o => o.id === id ? { ...o, ...updates } : o)
    }))
  },
  
  faqs: [],
  setFaqs: (faqs) => set({ faqs }),
  notices: [],
  setNotices: (notices) => set({ notices }),
  addFaq: async (faq) => {
    await supabase.from('faqs').insert(faq)
    set((state) => ({ faqs: [...state.faqs, faq] }))
  },
  updateFaq: async (id, faq) => {
    await supabase.from('faqs').update(faq).eq('id', id)
    set((state) => ({
      faqs: state.faqs.map(f => f.id === id ? { ...f, ...faq } : f)
    }))
  },
  deleteFaq: async (id) => {
    await supabase.from('faqs').delete().eq('id', id)
    set((state) => ({
      faqs: state.faqs.filter(f => f.id !== id)
    }))
  },
  addNotice: async (notice) => {
    try {
      await supabase.from('notices').insert(notice)
    } catch (err) {
      console.error('Error inserting notice to Supabase:', err)
    }
    set((state) => {
      const updated = [...state.notices, notice]
      if (typeof window !== 'undefined') {
        localStorage.setItem('vow_seoul_local_notices', JSON.stringify(updated))
      }
      return { notices: updated }
    })
  },
  updateNotice: async (id, notice) => {
    try {
      await supabase.from('notices').update(notice).eq('id', id)
    } catch (err) {
      console.error('Error updating notice in Supabase:', err)
    }
    set((state) => {
      const updated = state.notices.map(n => n.id === id ? { ...n, ...notice } : n)
      if (typeof window !== 'undefined') {
        localStorage.setItem('vow_seoul_local_notices', JSON.stringify(updated))
      }
      return { notices: updated }
    })
  },
  deleteNotice: async (id) => {
    try {
      await supabase.from('notices').delete().eq('id', id)
    } catch (err) {
      console.error('Error deleting notice from Supabase:', err)
    }
    set((state) => {
      const updated = state.notices.filter(n => n.id !== id)
      if (typeof window !== 'undefined') {
        localStorage.setItem('vow_seoul_local_notices', JSON.stringify(updated))
      }
      return { notices: updated }
    })
  },
  
  editorStep: 1,
  setEditorStep: (editorStep) => set({ editorStep }),
  activeSection: null,
  setActiveSection: (activeSection) => set({ activeSection }),
  
  isAuthenticated: false,
  isAdmin: false,
  setAuth: (isAuthenticated, isAdmin) => set({ isAuthenticated, isAdmin }),
  user: null as any | null,
  setUser: (user) => set({ user }),
  loadUserInvitations: async () => {
    const state = get()
    const userId = state.user?.id
    if (!userId) return

    try {
      const { data, error } = await supabase.from('invitations').select('*')
      if (data) {
        const userInvites = data
          .filter((inv: any) => inv.id.startsWith(userId + '__'))
          .map(mapFromDb)
        set({ invitations: userInvites })
      }
    } catch (err) {
      console.error('Error loading user invitations:', err)
    }
  },
}))

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    const store = useAppStore.getState()
    if (session?.user) {
      store.setUser(session.user)
      store.setAuth(true, session.user.email === 'vovvseoul@gmail.com')
      
      // Only load user invitations if we are on a page that needs them (mypage, editor, etc.) to prevent Web Locks error on other pages
      const path = window.location.pathname
      if (path.startsWith('/mypage') || path.startsWith('/my-invitations') || path.startsWith('/editor')) {
        store.loadUserInvitations()
      }
    } else {
      store.setUser(null)
      store.setAuth(false, false)
    }
  })
}

// Sample data
export const sampleThemes: Theme[] = [
  {
    id: 'classic-white',
    name: 'Classic White',
    thumbnail: '/themes/classic-white.jpg',
    tags: ['클래식', '화이트', '미니멀'],
    colorSets: [
      { id: 'ivory', name: 'Ivory', colors: ['#FFFFF0', '#F5F5DC', '#2C2C2C'] },
      { id: 'blush', name: 'Blush', colors: ['#FFF5F5', '#FFE4E1', '#2C2C2C'] },
    ],
    fontSets: [
      { id: 'serif', name: '명조체', fonts: ['Noto Serif KR', 'Georgia'] },
      { id: 'sans', name: '고딕체', fonts: ['Pretendard', 'Arial'] },
    ],
  },
  {
    id: 'romantic-rose',
    name: 'Romantic Rose',
    thumbnail: '/themes/romantic-rose.jpg',
    tags: ['로맨틱', '핑크', '플라워'],
    colorSets: [
      { id: 'rose', name: 'Rose', colors: ['#FFF0F5', '#FFB6C1', '#4A4A4A'] },
      { id: 'coral', name: 'Coral', colors: ['#FFF5EE', '#FFA07A', '#4A4A4A'] },
    ],
    fontSets: [
      { id: 'elegant', name: '엘레강스', fonts: ['Nanum Myeongjo', 'Playfair Display'] },
      { id: 'modern', name: '모던', fonts: ['Pretendard', 'Montserrat'] },
    ],
  },
  {
    id: 'modern-minimal',
    name: 'Modern Minimal',
    thumbnail: '/themes/modern-minimal.jpg',
    tags: ['모던', '미니멀', '심플'],
    colorSets: [
      { id: 'mono', name: 'Mono', colors: ['#FFFFFF', '#F0F0F0', '#1A1A1A'] },
      { id: 'warm', name: 'Warm', colors: ['#FFFAF5', '#F5E6D3', '#2C2C2C'] },
    ],
    fontSets: [
      { id: 'clean', name: '클린', fonts: ['Pretendard', 'Inter'] },
      { id: 'bold', name: '볼드', fonts: ['Pretendard', 'DM Sans'] },
    ],
  },
  {
    id: 'garden-greenery',
    name: 'Garden Greenery',
    thumbnail: '/themes/garden-greenery.jpg',
    tags: ['가든', '그린', '내추럴'],
    colorSets: [
      { id: 'sage', name: 'Sage', colors: ['#F5F5F0', '#9CAF88', '#3A3A3A'] },
      { id: 'olive', name: 'Olive', colors: ['#FAFAF5', '#808000', '#3A3A3A'] },
    ],
    fontSets: [
      { id: 'natural', name: '내추럴', fonts: ['Nanum Myeongjo', 'Cormorant'] },
      { id: 'fresh', name: '프레시', fonts: ['Pretendard', 'Nunito'] },
    ],
  },
  {
    id: 'elegant-navy',
    name: 'Elegant Navy',
    thumbnail: '/themes/elegant-navy.jpg',
    tags: ['엘레강스', '네이비', '고급'],
    colorSets: [
      { id: 'navy', name: 'Navy', colors: ['#F5F5FA', '#1B2951', '#FFFFFF'] },
      { id: 'midnight', name: 'Midnight', colors: ['#F0F0F5', '#191970', '#FFFFFF'] },
    ],
    fontSets: [
      { id: 'luxury', name: '럭셔리', fonts: ['Nanum Myeongjo', 'Cinzel'] },
      { id: 'refined', name: '정제', fonts: ['Pretendard', 'Libre Baskerville'] },
    ],
  },
  {
    id: 'sunset-warmth',
    name: 'Sunset Warmth',
    thumbnail: '/themes/sunset-warmth.jpg',
    tags: ['웜톤', '선셋', '따뜻한'],
    colorSets: [
      { id: 'sunset', name: 'Sunset', colors: ['#FFF8F0', '#E8A87C', '#3A3A3A'] },
      { id: 'terracotta', name: 'Terracotta', colors: ['#FAF5F0', '#C47151', '#3A3A3A'] },
    ],
    fontSets: [
      { id: 'warm', name: '웜', fonts: ['Nanum Myeongjo', 'Lora'] },
      { id: 'cozy', name: '코지', fonts: ['Pretendard', 'Quicksand'] },
    ],
  },
  {
    id: 'serene-blue',
    name: 'Serene Blue',
    thumbnail: '/themes/serene-blue.jpg',
    tags: ['차분한', '블루', '내추럴', '피그마 시안'],
    colorSets: [
      { id: 'slate-blue', name: 'Slate Blue', colors: ['#FFFFFF', '#9EB7CE', '#000000'] }
    ],
    fontSets: [
      { id: 'kaushan-radio', name: 'Kaushan & Radio Canada', fonts: ['Radio Canada Big', 'Kaushan Script'] }
    ],
    layout: 'classic',
    styles: {
      fontSizeBase: '14px',
      fontSize: '14px',
      letterSpacing: '-0.02em',
      primaryColor: '#9EB7CE',
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      secondaryColor: '#62798E',
      secondaryTextColor: '#838383',
      borderRadius: '0px',
      sectionSpacing: 'py-16',
      cardBg: 'bg-white',
      cardShadow: 'shadow-none',
      dividerType: 'line',
      heroStyle: 'center'
    }
  },
  {
    id: 'concept5',
    name: 'Pink Envelope',
    thumbnail: '/themes/concept5.jpg',
    tags: ['핑크', '감성', '피그마 시안'],
    colorSets: [
      { id: 'warm-pink', name: 'Pink Envelope', colors: ['#EFD0D0', '#D76C6C', '#FFFFFF'] }
    ],
    fontSets: [
      { id: 'goudy-radio', name: 'Goudy & Radio Canada', fonts: ['Radio Canada Big', 'Goudy Bookletter 1911', 'Covered By Your Grace'] }
    ],
    layout: 'classic',
    styles: {
      fontSizeBase: '14px',
      fontSize: '14px',
      letterSpacing: '-0.02em',
      primaryColor: '#D76C6C',
      backgroundColor: '#EFD0D0',
      textColor: '#FFFFFF',
      secondaryColor: '#EFD0D0',
      secondaryTextColor: '#FFFFFF',
      borderRadius: '0px',
      sectionSpacing: 'py-16',
      cardBg: 'bg-white',
      cardShadow: 'shadow-none',
      dividerType: 'none',
      heroStyle: 'center'
    }
  },
]

export const sampleBGMs: BGM[] = [
  { id: 'bgm1', name: 'Canon in D', artist: 'Pachelbel', duration: '3:24', url: '/bgm/canon.mp3', isRecommended: true },
  { id: 'bgm2', name: 'A Thousand Years', artist: 'Christina Perri', duration: '4:45', url: '/bgm/thousand.mp3', isRecommended: true },
  { id: 'bgm3', name: 'River Flows in You', artist: 'Yiruma', duration: '3:30', url: '/bgm/river.mp3', isRecommended: false },
  { id: 'bgm4', name: 'Wedding March', artist: 'Mendelssohn', duration: '4:52', url: '/bgm/wedding.mp3', isRecommended: false },
  { id: 'bgm5', name: 'Perfect', artist: 'Ed Sheeran', duration: '4:23', url: '/bgm/perfect.mp3', isRecommended: true },
]

export const sampleOrders: Order[] = [
  { id: 'ORD001', invitationId: 'INV001', customerName: '김철수', groomName: '김철수', brideName: '이영희', weddingDate: '2025-03-15', theme: 'Classic White', amount: 50000, status: 'deployed', createdAt: '2025-01-10', notes: '' },
  { id: 'ORD002', invitationId: 'INV002', customerName: '박민수', groomName: '박민수', brideName: '최수진', weddingDate: '2025-04-20', theme: 'Romantic Rose', amount: 50000, status: 'paid', createdAt: '2025-01-12', notes: '배경음악 변경 요청' },
  { id: 'ORD003', invitationId: 'INV003', customerName: '정대호', groomName: '정대호', brideName: '한지민', weddingDate: '2025-02-28', theme: 'Modern Minimal', amount: 50000, status: 'deployed', createdAt: '2025-01-08', notes: '' },
]

export const sampleFaqs: FAQ[] = [
  { id: 'faq1', question: '청첩장 제작은 얼마나 걸리나요?', answer: '기본 템플릿을 사용할 경우 결제 완료 후 10분 내로 즉시 제작되어 배포가 가능합니다.', category: '제작', createdAt: '2025-01-01' },
  { id: 'faq2', question: '완성된 청첩장을 수정할 수 있나요?', answer: '네, 결제 후에도 언제든지 내용을 수정하실 수 있으며, 변경 사항은 실시간으로 반영됩니다.', category: '수정', createdAt: '2025-01-02' },
  { id: 'faq3', question: '환불 규정이 어떻게 되나요?', answer: '결제 후 7일 이내, 청첩장을 한 번도 공유하지 않은 경우에 한하여 전액 환불이 가능합니다.', category: '결제', createdAt: '2025-01-03' },
]

export const sampleInvitations: WeddingInvitation[] = [
  {
    id: 'INV001',
    groomName: '김철수',
    groomNameEn: 'Kim Cheolsu',
    groomParentRelation: '아버지 김영수, 어머니 박미영의 장남',
    brideName: '이영희',
    brideNameEn: 'Lee Younghee',
    brideParentRelation: '아버지 이정호, 어머니 최순희의 차녀',
    weddingDate: '2025-03-15',
    weddingTime: '14:00',
    venueName: '그랜드 하얏트 서울',
    venueHall: '그랜드볼룸',
    venueAddress: '서울특별시 용산구 소월로 322',
    themeId: 'classic-white',
    colorSet: 'ivory',
    fontSet: 'serif',
    mainImage: null,
    invitationMessage: '서로 다른 길을 걸어온 저희 두 사람이\n이제 하나의 길을 함께 걸어가려 합니다.\n귀한 걸음으로 축복해 주시면 감사하겠습니다.',
    galleryImages: [],
    galleryViewType: 'slide',
    trafficInfo: '지하철 6호선 이태원역 1번 출구에서 도보 5분',
    parkingInfo: '호텔 지하주차장 이용 가능 (3시간 무료)',
    rsvpEnabled: true,
    rsvpMealEnabled: true,
    rsvpCommentEnabled: true,
    guestbookType: 'text',
    bgmId: 'bgm1',
    kakaoThumbnail: null,
    kakaoTitle: '철수 ♥ 영희 결혼합니다',
    kakaoDescription: '2025년 3월 15일 오후 2시',
    bankAccounts: [
      { id: '1', bank: '신한은행', accountNumber: '110-123-456789', accountHolder: '김철수', relation: 'groom' },
      { id: '2', bank: '국민은행', accountNumber: '123-456-789012', accountHolder: '이영희', relation: 'bride' },
    ],
    contacts: [
      { id: '1', name: '김철수', phone: '010-1234-5678', relation: '신랑' },
      { id: '2', name: '이영희', phone: '010-8765-4321', relation: '신부' },
    ],
    status: 'published',
    createdAt: '2025-01-10',
    publishedUrl: 'https://vow.seoul/inv/abc123',
  },
]

export const sampleNotices: Notice[] = [
  {
    id: 'notice1',
    title: 'VOW SEOUL 모바일 청첩장 서비스 정식 오픈 안내',
    content: '안녕하세요. VOW SEOUL입니다.\n가장 소중한 날을 아름답게 장식할 수 있도록 우아하고 프리미엄한 모바일 청첩장 서비스를 시작합니다.\n\n다양한 테마와 실시간 미리보기, 배경음악(BGM) 설정 및 송금 계좌 연동 등 완벽한 기능들을 지금 바로 만나보세요.\n\n앞으로도 더 나은 서비스로 보답하겠습니다.\n감사합니다.',
    category: '안내',
    createdAt: '2026-06-01'
  },
  {
    id: 'notice2',
    title: '축의금 송금 계좌 및 연락처 편집 기능 업데이트 완료',
    content: '안녕하세요. VOW SEOUL입니다.\n고객님들의 피드백을 반영하여 청첩장 만들기 페이지에서 등록하신 축의금 송금 계좌번호 및 연락처의 "수정" 기능이 추가되었습니다.\n이제 오타 수정 및 세부 사항 변경을 위해 삭제 후 재등록할 필요 없이 즉시 수정하여 편리하게 청첩장을 제작할 수 있습니다.\n\n더 나은 사용성을 위해 계속 노력하겠습니다.',
    category: '업데이트',
    createdAt: '2026-06-03'
  },
  {
    id: 'notice3',
    title: '6월 서비스 안정화 및 정기 점검 안내 (6월 10일)',
    content: '안녕하세요. VOW SEOUL 개발팀입니다.\n안정적인 서비스 제공을 위해 정기 서버 점검 및 최적화 작업이 진행될 예정입니다.\n\n- 일시: 2026년 6월 10일(수) 오전 02:00 ~ 05:00 (약 3시간)\n- 대상: VOW SEOUL 전체 서비스\n- 내용: 데이터베이스 안정화 작업 및 보안 패치 적용\n\n점검 시간 동안에는 청첩장 작성 및 수정이 일시적으로 제한될 수 있으니 양해 부탁드립니다.',
    category: '점검',
    createdAt: '2026-06-02'
  }
]

export interface Phrase {
  id: string
  category: 'classic' | 'modern' | 'romantic' | 'simple' | string
  text: string
}

export const samplePhrases: Phrase[] = [
  {
    id: '1',
    category: 'classic',
    text: '서로 다른 길을 걸어온 저희 두 사람이\n이제 하나의 길을 함께 걸어가려 합니다.\n귀한 걸음으로 축복해 주시면 감사하겠습니다.'
  },
  {
    id: '2',
    category: 'modern',
    text: '평생을 함께하고 싶은 사람을 만났습니다.\n서로의 손을 잡고 같은 곳을 바라보며\n행복한 가정을 꾸려가겠습니다.'
  },
  {
    id: '3',
    category: 'romantic',
    text: '저희 두 사람이 사랑과 믿음으로\n한 가정을 이루게 되었습니다.\n오셔서 축복해 주시면 큰 기쁨이겠습니다.'
  },
  {
    id: '4',
    category: 'simple',
    text: '소중한 분들을 모시고\n저희의 새로운 시작을 함께하고 싶습니다.\n바쁘시더라도 귀한 걸음 해주시어\n축복해 주시면 감사하겠습니다.'
  }
]

