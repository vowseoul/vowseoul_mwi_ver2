import { create } from 'zustand'
import { supabase, logSupabaseError } from './supabase'

export interface MockTheme {
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
  genre?: string
  hashtags?: string
}

export interface MockOrder {
  id: string
  invitationId: string
  customerName: string
  groomName: string
  brideName: string
  weddingDate: string
  theme: string
  amount: number
  status: 'registered' | 'form_sent' | 'form_completed' | 'in_production' | 'design_review' | 'published' | 'delivered'
  createdAt: string
  notes: string
}

interface AppState {
  // Data fetching
  fetchData: () => Promise<void>

  // Themes
  themes: MockTheme[]
  setThemes: (themes: MockTheme[]) => void
  
  // BGM
  bgmList: BGM[]
  setBgmList: (bgm: BGM[]) => void
  
  // Admin state
  orders: MockOrder[]
  setOrders: (orders: MockOrder[]) => void
  updateOrder: (id: string, updates: Partial<MockOrder>) => Promise<void>

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
}

export const useAppStore = create<AppState>((set, get) => ({
  fetchData: async () => {
    try {
      let themes: any[] = []
      try {
        const { data, error } = await supabase.from('themes').select('*')
        logSupabaseError('fetchData: themes', error)
        themes = data || []
      } catch (err) {
        themes = []
      }

      let bgms: any[] = []
      try {
        const { data, error } = await supabase.from('bgms').select('*')
        logSupabaseError('fetchData: bgms', error)
        bgms = data || []
      } catch (err) {
        bgms = []
      }

      let customers: any[] = []
      try {
        const { data, error } = await supabase.from('customers').select('*')
        logSupabaseError('fetchData: customers', error)
        customers = data || []
      } catch (err) {
        customers = []
      }

      // orders 는 제작 의뢰/이행 기록이다(§1-B). customer_id 로 표시용 이름/예식일을 채운다.
      const customerMap: Record<string, any> = {}
      customers.forEach((c: any) => { customerMap[c.id] = c })

      let mappedOrders: MockOrder[] = []
      try {
        const { data: ordersData, error } = await supabase.from('orders').select('*')
        logSupabaseError('fetchData: orders', error)
        mappedOrders = (ordersData || []).map((o: any) => {
          const cust = o.customer_id ? customerMap[o.customer_id] : null
          return {
            id: o.id,
            invitationId: o.invitation_id || '',
            customerName: cust ? `${cust.groom_name} & ${cust.bride_name}` : (o.external_order_ref || '고객 미지정'),
            groomName: cust?.groom_name || '',
            brideName: cust?.bride_name || '',
            weddingDate: cust?.wedding_date || '',
            theme: '',
            amount: o.amount,
            status: o.status,
            createdAt: o.created_at ? o.created_at.split('T')[0] : '',
            notes: o.notes || '',
          }
        })
      } catch (err) {
        mappedOrders = []
      }

      set({
        themes: themes || [],
        bgmList: bgms.length > 0 ? bgms : sampleBGMs,
        orders: mappedOrders,
      })
    } catch (e) {
      console.error('Error fetching data from Supabase:', e)
    }
  },

  themes: [],
  setThemes: (themes) => set({ themes }),
  
  bgmList: [],
  setBgmList: (bgmList) => set({ bgmList }),
  
  orders: [],
  setOrders: (orders) => set({ orders }),
  updateOrder: async (id, updates) => {
    try {
      const orderUpdates: any = {}
      if (updates.amount !== undefined) orderUpdates.amount = updates.amount
      if (updates.status !== undefined) orderUpdates.status = updates.status
      if (updates.notes !== undefined) orderUpdates.notes = updates.notes

      if (Object.keys(orderUpdates).length > 0) {
        const { error } = await supabase.from('orders').update(orderUpdates).eq('id', id)
        logSupabaseError('updateOrder', error)
      }

      // 고객 기본 정보(이름/예식일)는 orders 가 아니라 customers 소유이므로,
      // 주문에 연결된 customer_id 를 찾아 함께 갱신한다.
      if (updates.groomName || updates.brideName || updates.weddingDate) {
        const state = get()
        const order = state.orders.find(o => o.id === id)
        const { data: orderRow } = await supabase.from('orders').select('customer_id').eq('id', id).maybeSingle()
        const customerId = orderRow?.customer_id
        if (customerId) {
          const customerUpdates: any = {}
          if (updates.groomName) customerUpdates.groom_name = updates.groomName
          if (updates.brideName) customerUpdates.bride_name = updates.brideName
          if (updates.weddingDate) customerUpdates.wedding_date = updates.weddingDate
          await supabase.from('customers').update(customerUpdates).eq('id', customerId)
        }
      }
    } catch (err) {
      console.error('Error updating order:', err)
    }

    set((state) => ({
      orders: state.orders.map(o => o.id === id ? { ...o, ...updates } : o)
    }))
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
}))

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    const store = useAppStore.getState()
    if (session?.user) {
      store.setUser(session.user)
      store.setAuth(true, session.user.email === 'vovvseoul@gmail.com')
    } else {
      store.setUser(null)
      store.setAuth(false, false)
    }
  })
}

// Sample data
export const sampleThemes: MockTheme[] = [
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

