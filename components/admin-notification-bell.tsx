'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  type AdminNotification,
} from '@/hooks/queries/useNotifications'
import { cn } from '@/lib/utils'

export function AdminNotificationBell() {
  const { data: notifications = [] } = useNotificationsQuery()
  const markRead = useMarkNotificationReadMutation()
  const markAllRead = useMarkAllNotificationsReadMutation()
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">알림</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              모두 읽음 처리
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">알림이 없습니다.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onRead={() => markRead.mutate(n.id)} />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationRow({ notification, onRead }: { notification: AdminNotification; onRead: () => void }) {
  const body = (
    <>
      <div className="flex w-full items-center gap-1.5">
        {!notification.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        <span className="text-xs font-medium">{notification.title}</span>
      </div>
      <span className="text-xs text-muted-foreground">{notification.message}</span>
      <span className="text-[10px] text-muted-foreground/70">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ko })}
      </span>
    </>
  )
  const itemClassName = cn('flex flex-col items-start gap-0.5 whitespace-normal py-2', !notification.is_read && 'bg-muted/50')
  const handleClick = () => { if (!notification.is_read) onRead() }

  if (!notification.link_to) {
    return <DropdownMenuItem onClick={handleClick} className={itemClassName}>{body}</DropdownMenuItem>
  }
  return (
    <DropdownMenuItem asChild onClick={handleClick} className={itemClassName}>
      <Link href={notification.link_to}>{body}</Link>
    </DropdownMenuItem>
  )
}
