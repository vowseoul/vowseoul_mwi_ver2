'use client'

import { create } from 'zustand'
import { buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  /** 삭제 등 되돌리기 어려운 동작이면 true — 확인 버튼이 destructive 톤으로 표시된다 */
  destructive?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((value: boolean) => void) | null
}

const useConfirmStore = create<ConfirmState>(() => ({
  open: false,
  title: '',
  resolve: null,
}))

/**
 * window.confirm() 대체 — 브라우저 네이티브 확인창 대신 앱 톤에 맞는 AlertDialog로 확인을 받는다.
 * 호출부는 `if (!(await confirmDialog({ title: "...", destructive: true }))) return` 형태로
 * 기존 `if (!confirm("...")) return` 을 그대로 대체할 수 있다. 렌더링은 <ConfirmDialogHost/>
 * (app/layout.tsx에 1회 마운트)가 전역으로 담당한다.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.setState({ ...options, open: true, resolve })
  })
}

export function ConfirmDialogHost() {
  const state = useConfirmStore()

  const settle = (result: boolean) => {
    state.resolve?.(result)
    useConfirmStore.setState({ open: false, resolve: null })
  }

  return (
    <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) settle(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>{state.cancelText || '취소'}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={state.destructive ? buttonVariants({ variant: 'destructive' }) : undefined}
          >
            {state.confirmText || '확인'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
