'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCustomersQuery, type CustomerFilters } from '@/hooks/queries/useCustomers'
import { cn } from '@/lib/utils'

/**
 * 고객 선택 드롭다운.
 *
 * 예전엔 그냥 <Select> 에 useCustomersQuery(..., 1, 100) 결과를 쏟아부었다 — 검색이
 * 없어서 101번째부터는 목록에 아예 나오지 않았고, 고객이 쌓이면 폼 발송/청첩장 생성이
 * 통째로 막히는 구조였다. useCustomersQuery 는 이미 groom_name/bride_name/phone 에
 * 대한 서버사이드 ilike 검색을 지원하므로(§hooks/queries/useCustomers.ts), 입력값을
 * 그 필터로 넘겨 항상 "검색 결과 상위 N건"만 보여준다. 즉 전체 고객 수와 무관하게 동작한다.
 */
const PAGE_SIZE = 20

export interface CustomerPickerValue {
  id: string
  groom_name: string
  bride_name: string
  wedding_date: string | null
}

export function CustomerPicker({
  value,
  onChange,
  filters = {},
  placeholder = '고객 검색 후 선택',
  emptyText = '표시할 고객이 없습니다.',
  emptyOption,
  id,
}: {
  value: string
  onChange: (customerId: string, customer: CustomerPickerValue | null) => void
  /** 검색 전에 결과가 0건일 때 보여줄 문구. filters 로 좁혀 쓰는 화면은 왜 비었는지
   *  알려줘야 한다 — 그냥 "고객이 없습니다" 는 등록된 고객이 하나도 없다는 뜻으로 읽힌다 */
  emptyText?: string
  /** status 등 추가 조건 (검색어는 이 컴포넌트가 직접 넣는다) */
  filters?: Omit<CustomerFilters, 'search'>
  placeholder?: string
  /** '고객 없이 진행' 같은 선택지가 필요한 화면에서만 전달 */
  emptyOption?: { value: string; label: string }
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  // 선택된 고객은 검색어가 바뀌어 목록에서 사라져도 트리거에 계속 표시돼야 한다
  const [selected, setSelected] = useState<CustomerPickerValue | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isFetching } = useCustomersQuery(
    { ...filters, ...(debounced ? { search: debounced } : {}) },
    1,
    PAGE_SIZE,
  )
  const customers = (data?.data ?? []) as CustomerPickerValue[]
  const total = data?.count ?? 0

  const label = selected
    ? `${selected.groom_name} & ${selected.bride_name} (예식일: ${selected.wedding_date || '미정'})`
    : emptyOption && value === emptyOption.value
      ? emptyOption.label
      : ''

  const pick = (customerId: string, customer: CustomerPickerValue | null) => {
    setSelected(customer)
    onChange(customerId, customer)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !label && 'text-muted-foreground')}>
            {label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 연락처로 검색"
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
          {isFetching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {emptyOption && (
            <button
              type="button"
              onClick={() => pick(emptyOption.value, null)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
            >
              <Check className={cn('h-3.5 w-3.5 shrink-0', value === emptyOption.value ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate">{emptyOption.label}</span>
            </button>
          )}

          {customers.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {debounced ? '검색 결과가 없습니다.' : emptyText}
            </p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id, c)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <Check className={cn('h-3.5 w-3.5 shrink-0', value === c.id ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">
                  {c.groom_name} & {c.bride_name}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    예식일: {c.wedding_date || '미정'}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {total > customers.length && (
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            {total}명 중 {customers.length}명 표시 — 검색으로 좁혀주세요.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
