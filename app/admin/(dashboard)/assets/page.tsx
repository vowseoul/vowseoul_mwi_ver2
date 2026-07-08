'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { sampleThemes, sampleBGMs, Theme, samplePhrases } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Plus, Play, Pause, Trash2, Upload, Loader2, CheckCircle2 } from 'lucide-react'
import { uploadFile, deleteFile } from '@/lib/storage'
import Link from 'next/link'

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState('themes')
  const [playingBgm, setPlayingBgm] = useState<string | null>(null)
  const [themeEnabled, setThemeEnabled] = useState<Record<string, boolean>>({
    'classic-white': true,
    'romantic-rose': true,
    'modern-minimal': true,
    'garden-greenery': true,
    'elegant-navy': false,
    'sunset-warmth': true,
  })
  const [themes, setThemes] = useState<Theme[]>([])
  const [isLoadingThemes, setIsLoadingThemes] = useState(true)
  const [bgms, setBgms] = useState<any[]>([])
  const [isLoadingBgms, setIsLoadingBgms] = useState(true)
  const [newBgmName, setNewBgmName] = useState('')
  const [newBgmArtist, setNewBgmArtist] = useState('')
  const [newBgmGenre, setNewBgmGenre] = useState('')
  const [newBgmHashtags, setNewBgmHashtags] = useState('')
  const [editingBgmId, setEditingBgmId] = useState<string | null>(null)
  const [isSavingBgm, setIsSavingBgm] = useState(false)
  const [isBgmDialogOpen, setIsBgmDialogOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [fonts, setFonts] = useState<any[]>([])
  const [isLoadingFonts, setIsLoadingFonts] = useState(true)
  const [newFontName, setNewFontName] = useState('')
  const [newFontFamily, setNewFontFamily] = useState('')
  const [fontType, setFontType] = useState<'embed' | 'file'>('embed')
  const [embedCode, setEmbedCode] = useState('')
  const [fontFileUrl, setFontFileUrl] = useState<string | null>(null)
  const [isUploadingFont, setIsUploadingFont] = useState(false)
  const [isSavingFont, setIsSavingFont] = useState(false)
  const [isFontDialogOpen, setIsFontDialogOpen] = useState(false)
  const fontFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchThemes()
    fetchBgms()
    fetchFonts()
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  const fetchFonts = async () => {
    setIsLoadingFonts(true)
    try {
      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'fonts')
      
      if (data && data.length > 0 && data[0].value) {
        setFonts(data[0].value)
      } else {
        setFonts([])
      }
    } catch (err) {
      console.error('Error fetching fonts:', err)
      setFonts([])
    } finally {
      setIsLoadingFonts(false)
    }
  }

  const handleFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingFont(true)
    try {
      const url = await uploadFile(e.target.files[0], 'fonts')
      setFontFileUrl(url)
    } catch (err) {
      alert('폰트 파일 업로드에 실패했습니다.')
    } finally {
      setIsUploadingFont(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSaveFont = async () => {
    if (!newFontName || !newFontFamily) return alert('폰트명과 폰트 패밀리명을 입력해주세요.')
    if (fontType === 'embed' && !embedCode) return alert('웹 폰트 임베드 코드를 입력해주세요.')
    if (fontType === 'file' && !fontFileUrl) return alert('TTF 폰트 파일을 업로드해주세요.')

    setIsSavingFont(true)
    try {
      const newFont = {
        id: `font_${Date.now()}`,
        name: newFontName,
        family: newFontFamily,
        type: fontType,
        embedCode: fontType === 'embed' ? embedCode : undefined,
        fileUrl: fontType === 'file' ? fontFileUrl : undefined
      }

      const updatedFonts = [...fonts, newFont]
      
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'fonts', value: updatedFonts, updatedAt: new Date().toISOString() })

      if (error) throw error

      setIsFontDialogOpen(false)
      resetFontForm()
      await fetchFonts()
    } catch (err) {
      console.error('Save font error:', err)
      alert('폰트 저장에 실패했습니다.')
    } finally {
      setIsSavingFont(false)
    }
  }

  const handleDeleteFont = async (id: string) => {
    if (!confirm('정말로 이 폰트를 삭제하시겠습니까?')) return
    try {
      const fontToDelete = fonts.find(f => f.id === id)
      if (fontToDelete && fontToDelete.type === 'file' && fontToDelete.fileUrl) {
        try {
          await deleteFile(fontToDelete.fileUrl)
        } catch (e) {
          console.warn('Could not delete font file from storage:', e)
        }
      }

      const updatedFonts = fonts.filter(f => f.id !== id)
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'fonts', value: updatedFonts, updatedAt: new Date().toISOString() })

      if (error) throw error
      await fetchFonts()
    } catch (err) {
      console.error('Delete font error:', err)
      alert('폰트 삭제에 실패했습니다.')
    }
  }

  const resetFontForm = () => {
    setNewFontName('')
    setNewFontFamily('')
    setFontType('embed')
    setEmbedCode('')
    setFontFileUrl(null)
  }

  const fetchBgms = async () => {
    setIsLoadingBgms(true)
    const { data } = await supabase.from('bgms').select('*')
    if (data && data.length > 0) {
      setBgms(data)
    } else {
      setBgms(sampleBGMs)
    }
    setIsLoadingBgms(false)
  }

  const fetchThemes = async () => {
    setIsLoadingThemes(true)
    const { data, error } = await supabase.from('themes').select('*')
    if (data && data.length > 0) {
      setThemes(data as any)
    } else {
      setThemes(sampleThemes)
    }
    setIsLoadingThemes(false)
  }

  const togglePlay = (bgmId: string, bgmUrl?: string) => {
    if (playingBgm === bgmId) {
      if (audioRef.current) audioRef.current.pause()
      setPlayingBgm(null)
    } else {
      if (audioRef.current) audioRef.current.pause()
      
      const url = bgmUrl || bgms.find(b => b.id === bgmId)?.url
      if (url) {
        audioRef.current = new Audio(url)
        audioRef.current.play().catch(e => console.error('Audio play error:', e))
        audioRef.current.onended = () => setPlayingBgm(null)
        setPlayingBgm(bgmId)
      }
    }
  }

  const [isUploadingTheme, setIsUploadingTheme] = useState(false)
  const [themeImageUrl, setThemeImageUrl] = useState<string | null>(null)
  const themeImageInputRef = useRef<HTMLInputElement>(null)

  const handleThemeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingTheme(true)
    try {
      const url = await uploadFile(e.target.files[0], 'theme-thumbnails')
      setThemeImageUrl(url)
    } catch (err) {
      alert('테마 이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingTheme(false)
      if (e.target) e.target.value = ''
    }
  }

  const [isUploadingBgm, setIsUploadingBgm] = useState(false)
  const [bgmUrl, setBgmUrl] = useState<string | null>(null)
  const bgmInputRef = useRef<HTMLInputElement>(null)

  const handleBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingBgm(true)
    try {
      const url = await uploadFile(e.target.files[0], 'bgm')
      setBgmUrl(url)
    } catch (err) {
      alert('BGM 파일 업로드에 실패했습니다.')
    } finally {
      setIsUploadingBgm(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSaveBgm = async () => {
    if (!bgmUrl || !newBgmName) return alert('음원 파일과 곡명을 입력해주세요.')
    setIsSavingBgm(true)
    const newBgm = {
      id: editingBgmId || `bgm_${Date.now()}`,
      name: newBgmName,
      artist: newBgmArtist || 'Unknown',
      genre: newBgmGenre,
      hashtags: newBgmHashtags,
      duration: '-', // 나중에 메타데이터를 파싱하여 넣을 수 있습니다.
      url: bgmUrl,
      isRecommended: false // Deprecated: Now managed per theme
    }
    const { error } = await supabase.from('bgms').upsert(newBgm)
    setIsSavingBgm(false)
    if (error) {
      alert('BGM 저장에 실패했습니다.')
      console.error(error)
    } else {
      setIsBgmDialogOpen(false)
      resetBgmForm()
      fetchBgms() // 목록 새로고침
    }
  }

  const handleDeleteBgm = async (id: string) => {
    if (!confirm('정말로 이 BGM을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('bgms').delete().eq('id', id)
    if (error) {
      alert('BGM 삭제에 실패했습니다.')
    } else {
      fetchBgms()
    }
  }

  const resetBgmForm = () => {
    setEditingBgmId(null)
    setBgmUrl(null)
    setNewBgmName('')
    setNewBgmArtist('')
    setNewBgmGenre('')
    setNewBgmHashtags('')
  }

  const openBgmEditDialog = (bgm: any) => {
    setEditingBgmId(bgm.id)
    setBgmUrl(bgm.url)
    setNewBgmName(bgm.name)
    setNewBgmArtist(bgm.artist || '')
    setNewBgmGenre(bgm.genre || '')
    setNewBgmHashtags(bgm.hashtags || '')
    setIsBgmDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">에셋 및 템플릿 관리</h1>
        <p className="text-muted-foreground">테마, 문구, BGM을 관리합니다.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="themes">테마 관리</TabsTrigger>
          <TabsTrigger value="phrases">문구 관리</TabsTrigger>
          <TabsTrigger value="bgm">BGM 관리</TabsTrigger>
          <TabsTrigger value="fonts">폰트 관리</TabsTrigger>
        </TabsList>

        {/* Themes */}
        <TabsContent value="themes" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">테마 목록</CardTitle>
                <CardDescription>청첩장 테마를 관리합니다.</CardDescription>
              </div>
              <Button asChild>
                <Link href="/admin/assets/themes/new">
                  <Plus className="mr-2 h-4 w-4" />
                  새 테마 등록
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingThemes ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {themes.map((theme) => {
                    // 안전한 렌더링을 위해 colorSets 배열과 그 안의 colors가 존재하는지 확인합니다.
                    const defaultBg = theme.colorSets?.[0]?.colors?.[0] || theme.styles?.backgroundColor || '#FFF8F0';
                    const defaultText = theme.colorSets?.[0]?.colors?.[2] || theme.styles?.textColor || '#3A3A3A';
                    const defaultPrimary = theme.colorSets?.[0]?.colors?.[1] || theme.styles?.primaryColor || '#E8A87C';
                    
                    return (
                      <div 
                        key={theme.id} 
                        className="overflow-hidden rounded-lg border border-border transition-all hover:border-primary/50"
                      >
                        <Link href={`/admin/assets/themes/${theme.id}`} className="block">
                          <div 
                            className="aspect-[3/4] p-4 cursor-pointer"
                            style={{ backgroundColor: defaultBg }}
                          >
                            <div 
                              className="flex h-full flex-col items-center justify-center text-center"
                              style={{ color: defaultText }}
                            >
                              <p className="font-serif text-sm">Preview</p>
                              <div 
                                className="mt-3 h-12 w-10 rounded-sm"
                                style={{ backgroundColor: defaultPrimary }}
                              />
                            </div>
                          </div>
                        </Link>
                        <div className="border-t border-border bg-background p-3">
                          <div className="flex items-center justify-between">
                            <Link href={`/admin/assets/themes/${theme.id}`} className="hover:underline">
                              <p className="font-medium">{theme.name}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(Array.isArray(theme.tags) ? theme.tags : []).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[10px]">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </Link>
                          <Switch
                            checked={themeEnabled[theme.id] ?? true}
                            onCheckedChange={(checked) => 
                              setThemeEnabled({ ...themeEnabled, [theme.id]: checked })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phrases */}
        <TabsContent value="phrases" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">문구 목록</CardTitle>
                <CardDescription>청첩장 샘플 문구를 관리합니다.</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    새 문구 추가
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 문구 추가</DialogTitle>
                    <DialogDescription>새로운 샘플 문구를 추가합니다.</DialogDescription>
                  </DialogHeader>
                  <FieldGroup className="mt-4">
                    <Field>
                      <FieldLabel>카테고리</FieldLabel>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="카테고리 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="classic">클래식</SelectItem>
                          <SelectItem value="modern">모던</SelectItem>
                          <SelectItem value="romantic">로맨틱</SelectItem>
                          <SelectItem value="simple">심플</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>문구 내용</FieldLabel>
                      <Textarea placeholder="문구 내용을 입력하세요" rows={4} />
                    </Field>
                  </FieldGroup>
                  <Button className="mt-4 w-full">추가하기</Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {samplePhrases.map((phrase) => (
                  <div 
                    key={phrase.id} 
                    className="flex items-start justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex-1">
                      <Badge variant="secondary" className="mb-2 text-xs">
                        {phrase.category === 'classic' ? '클래식' : 
                         phrase.category === 'modern' ? '모던' : 
                         phrase.category === 'romantic' ? '로맨틱' : '심플'}
                      </Badge>
                      <p className="whitespace-pre-line text-sm">{phrase.text}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BGM */}
        <TabsContent value="bgm" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">BGM 목록</CardTitle>
                <CardDescription>청첩장 배경음악을 관리합니다.</CardDescription>
              </div>
              <Dialog open={isBgmDialogOpen} onOpenChange={(open) => {
                if (!open) resetBgmForm()
                setIsBgmDialogOpen(open)
              }}>
                <DialogTrigger asChild>
                  <Button onClick={resetBgmForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    음원 업로드
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingBgmId ? '음원 수정' : '음원 업로드'}</DialogTitle>
                    <DialogDescription>{editingBgmId ? '등록된 배경음악 정보를 수정합니다.' : '새로운 배경음악을 업로드합니다.'}</DialogDescription>
                  </DialogHeader>
                  <FieldGroup className="mt-4">
                    <Field>
                      <FieldLabel>음원 파일</FieldLabel>
                      <div className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 cursor-pointer" onClick={() => bgmInputRef.current?.click()}>
                        <div className="text-center">
                          {bgmUrl ? (
                            <>
                              <CheckCircle2 className="mx-auto h-6 w-6 text-green-500" />
                              <p className="mt-1 text-xs text-green-600">업로드 완료</p>
                            </>
                          ) : isUploadingBgm ? (
                            <>
                              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                              <p className="mt-1 text-xs text-muted-foreground">업로드 중...</p>
                            </>
                          ) : (
                            <>
                              <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                              <p className="mt-1 text-xs text-muted-foreground">MP3 파일 업로드</p>
                            </>
                          )}
                        </div>
                      </div>
                      <input 
                        type="file" 
                        accept="audio/*" 
                        className="hidden" 
                        ref={bgmInputRef}
                        onChange={handleBgmUpload}
                        disabled={isUploadingBgm}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>곡명</FieldLabel>
                      <Input placeholder="곡 제목을 입력하세요" value={newBgmName} onChange={e => setNewBgmName(e.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel>아티스트</FieldLabel>
                      <Input placeholder="아티스트명을 입력하세요" value={newBgmArtist} onChange={e => setNewBgmArtist(e.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel>장르</FieldLabel>
                      <Input placeholder="클래식, 팝, 재즈 등" value={newBgmGenre} onChange={e => setNewBgmGenre(e.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel>해시태그 (무드)</FieldLabel>
                      <Input placeholder="#잔잔한 #로맨틱 (공백으로 구분)" value={newBgmHashtags} onChange={e => setNewBgmHashtags(e.target.value)} />
                    </Field>
                  </FieldGroup>
                  <Button className="mt-4 w-full" onClick={handleSaveBgm} disabled={isSavingBgm || isUploadingBgm}>
                    {isSavingBgm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingBgmId ? '수정하기' : '업로드'}
                  </Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingBgms ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {bgms.map((bgm) => (
                  <div 
                    key={bgm.id} 
                    className="flex items-center gap-4 rounded-lg border border-border p-4"
                  >
                    <button
                      onClick={() => togglePlay(bgm.id, bgm.url)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background shrink-0"
                    >
                      {playingBgm === bgm.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="ml-0.5 h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{bgm.name}</p>
                        {bgm.genre && <Badge variant="outline" className="text-xs">{bgm.genre}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {bgm.artist} · {bgm.duration}
                      </p>
                      {bgm.hashtags && (
                        <p className="text-xs text-muted-foreground mt-1">{bgm.hashtags}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openBgmEditDialog(bgm)}>
                      수정
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteBgm(bgm.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fonts Tab */}
        <TabsContent value="fonts" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">폰트 관리</CardTitle>
                <CardDescription>구글 웹 폰트 임베드 코드 등록 및 TTF 폰트 파일을 에셋으로 등록합니다.</CardDescription>
              </div>
              <Dialog open={isFontDialogOpen} onOpenChange={(open) => {
                if (!open) resetFontForm()
                setIsFontDialogOpen(open)
              }}>
                <DialogTrigger asChild>
                  <Button onClick={resetFontForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    새 폰트 추가
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 폰트 등록</DialogTitle>
                    <DialogDescription>임베드 코드 입력 혹은 TTF 파일을 통해 폰트를 등록합니다.</DialogDescription>
                  </DialogHeader>
                  <FieldGroup className="mt-4">
                    <Field>
                      <FieldLabel>폰트명 (표기용)</FieldLabel>
                      <Input placeholder="예: 나눔바른펜, 나눔손글씨 붓" value={newFontName} onChange={e => setNewFontName(e.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel>폰트 패밀리명 (CSS font-family 명칭)</FieldLabel>
                      <Input placeholder="예: NanumBarunpen, NanumBrush" value={newFontFamily} onChange={e => setNewFontFamily(e.target.value)} />
                      <p className="text-[11px] text-muted-foreground mt-1 text-red-500 font-medium">
                        * Google Fonts 등 공백이 포함된 폰트는 공백을 포함하여 대소문자를 정확히 입력해주세요. (예: Lobster Two (O), LobsterTwo (X))
                      </p>
                    </Field>
                    <Field>
                      <FieldLabel>등록 방식</FieldLabel>
                      <Select value={fontType} onValueChange={(v: 'embed' | 'file') => setFontType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="embed">웹 폰트 임베드 코드 (CSS @import)</SelectItem>
                          <SelectItem value="file">TTF 파일 직접 업로드</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    
                    {fontType === 'embed' ? (
                      <Field>
                        <FieldLabel>CSS @import 코드 또는 URL</FieldLabel>
                        <Textarea 
                          placeholder="예: @import url('https://fonts.googleapis.com/css2?family=Nanum+Brush+Script&display=swap');" 
                          value={embedCode} 
                          onChange={e => setEmbedCode(e.target.value)}
                          rows={4} 
                        />
                      </Field>
                    ) : (
                      <Field>
                        <FieldLabel>TTF 파일 (.ttf)</FieldLabel>
                        <div className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 cursor-pointer" onClick={() => fontFileInputRef.current?.click()}>
                          <div className="text-center">
                            {fontFileUrl ? (
                              <>
                                <CheckCircle2 className="mx-auto h-6 w-6 text-green-500" />
                                <p className="mt-1 text-xs text-green-600">업로드 완료</p>
                              </>
                            ) : isUploadingFont ? (
                              <>
                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                <p className="mt-1 text-xs text-muted-foreground">업로드 중...</p>
                              </>
                            ) : (
                              <>
                                <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                                <p className="mt-1 text-xs text-muted-foreground">TTF 파일 업로드</p>
                              </>
                            )}
                          </div>
                        </div>
                        <input 
                          type="file" 
                          accept=".ttf" 
                          className="hidden" 
                          ref={fontFileInputRef}
                          onChange={handleFontFileUpload}
                          disabled={isUploadingFont}
                        />
                      </Field>
                    )}
                  </FieldGroup>
                  <Button className="mt-4 w-full" onClick={handleSaveFont} disabled={isSavingFont || isUploadingFont}>
                    {isSavingFont ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    등록하기
                  </Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingFonts ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : fonts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  등록된 사용자 정의 폰트가 없습니다.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {fonts.map((font) => (
                    <div 
                      key={font.id} 
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div>
                        <p className="font-semibold text-sm">{font.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Family: {font.family}</p>
                        <div className="mt-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {font.type === 'embed' ? 'CSS @import' : 'TTF 파일'}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteFont(font.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
