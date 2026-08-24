import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { List, Tag, Button, Empty, Badge, Segmented, Tooltip } from 'antd'
import {
  Bell, AlertTriangle, FileText, CheckCircle2, Clock, CheckCheck, Award, Filter, ExternalLink, X
} from 'lucide-react'
import { ardOpsApi, type ArdNotification } from '../../api/ard'
import dayjs from 'dayjs'

export default function ArdNotificationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['ard-notifications'],
    queryFn: ardOpsApi.notifications,
    refetchInterval: parseInt(import.meta.env.VITE_NOTIFICATION_POLL_MS ?? '15000'),
  })

  const markAllRead = useMutation({
    mutationFn: ardOpsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ard-notifications'] }),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => ardOpsApi.markRead([id]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ard-notifications'] }),
  })

  const dismiss = (id: string) => setDismissed(prev => new Set([...prev, id]))
  const clearRead = () => {
    const readIds = (data?.items ?? []).filter(i => i.read).map(i => i.id)
    setDismissed(prev => new Set([...prev, ...readIds]))
  }

  const items = (data?.items ?? []).filter(i => !dismissed.has(i.id))
  const unreadCount = items.filter(i => !i.read).length

  const filteredItems = items.filter((item) => {
    if (filterCategory === 'unread') return !item.read
    if (filterCategory === 'qualification') return item.category === 'qualification'
    if (filterCategory === 'atr') return item.category === 'atr'
    if (filterCategory === 'workflow') return item.category === 'workflow'
    return true
  })

  const getToneBadge = (tone: string) => {
    switch (tone) {
      case 'error':
        return { color: 'red', icon: AlertTriangle, bg: 'bg-red-50 text-red-600 border-red-200' }
      case 'warning':
        return { color: 'gold', icon: Clock, bg: 'bg-amber-50 text-amber-600 border-amber-200' }
      case 'success':
        return { color: 'green', icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
      default:
        return { color: 'blue', icon: Bell, bg: 'bg-blue-50 text-blue-600 border-blue-200' }
    }
  }

  const getCategoryIcon = (title: string, tone: string) => {
    if (title.toLowerCase().includes('qualification')) return Award
    if (title.toLowerCase().includes('atr')) return FileText
    if (title.toLowerCase().includes('approval') || title.toLowerCase().includes('verification')) return CheckCircle2
    return Bell
  }

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">Notifications &amp; Alerts</h1>
      </div>
      {/* Filter and Control Bar */}
      <div className="glass-card rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={15} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filter:</span>
          <Segmented
            value={filterCategory}
            onChange={(val) => setFilterCategory(String(val))}
            options={[
              { label: `All (${items.length})`, value: 'all' },
              { label: `Unread (${unreadCount})`, value: 'unread' },
              { label: 'Qualifications', value: 'qualification' },
              { label: 'ATR Status', value: 'atr' },
              { label: 'Workflows', value: 'workflow' },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCheck size={14} />}
              onClick={() => markAllRead.mutate()}
              loading={markAllRead.isPending}
              className="bg-violet-600 hover:bg-violet-700 font-semibold text-xs"
            >
              Mark all read ({unreadCount})
            </Button>
          )}
          {items.some((i) => i.read) && (
            <Button size="small" onClick={clearRead} className="text-slate-500 text-xs">
              Clear read
            </Button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="glass-card rounded-lg p-4">
        <List
          loading={isLoading}
          dataSource={filteredItems}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span className="text-slate-400">No notifications found in this category</span>}
              />
            ),
          }}
          renderItem={(item: ArdNotification) => {
            const toneInfo = getToneBadge(item.tone)
            const IconComp = getCategoryIcon(item.title, item.tone)

            return (
              <List.Item
                key={item.id}
                className={`group px-4 py-4 rounded-lg transition-all mb-2 cursor-pointer border ${
                  !item.read
                    ? 'bg-blue-50/40 border-blue-100/80 hover:bg-blue-50/70'
                    : 'bg-white border-slate-100 hover:bg-slate-50'
                }`}
                onClick={() => {
                  if (!item.read) markRead.mutate(item.id)
                  navigate(item.href)
                }}
              >
                <div className="flex items-start gap-4 w-full">
                  {/* Category Icon Badge */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${toneInfo.bg}`}>
                    <IconComp size={18} />
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`font-semibold text-sm ${!item.read ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                          {item.title}
                        </span>
                        {!item.read && (
                          <Tag color="blue" className="text-[10px] px-2 py-0.5 rounded-full font-bold border-none">
                            NEW
                          </Tag>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {item.at ? dayjs(item.at).format('DD MMM YYYY HH:mm') : ''}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{item.body}</p>
                  </div>

                  {/* Hover Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center pl-2 flex gap-1">
                    <Tooltip title="View details">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); if (!item.read) markRead.mutate(item.id); navigate(item.href) }}>
                        <ExternalLink size={14} />
                      </div>
                    </Tooltip>
                    <Tooltip title="Dismiss">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); dismiss(item.id) }}>
                        <X size={14} />
                      </div>
                    </Tooltip>
                  </div>
                </div>
              </List.Item>
            )
          }}
        />
      </div>
    </div>
  )
}
