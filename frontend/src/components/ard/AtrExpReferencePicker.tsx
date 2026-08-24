import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal, Select, Tag, Typography, Space } from 'antd'
import { Link, Plus, X } from 'lucide-react'
import { apiGet } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

const { Text } = Typography

export interface ExperimentOption {
  id: string
  expCode: string
  title: string
  status: string
}

export interface AtrExpReferencePickerProps {
  value?: string
  readOnly?: boolean
  onChange?: (value: string) => void
  onLink?: (exp: ExperimentOption) => void
}

async function fetchExperiments(): Promise<ExperimentOption[]> {
  try {
    const res = await apiGet<{ items?: Record<string, unknown>[] }>('/api/ard/experiments')
    const items = res?.items || []
    return items.map((item) => ({
      id: String(item.id || ''),
      expCode: String(item.code || item.exp_code || item.expCode || item.formNo || item.id || ''),
      title: String(item.title || item.name || item.description || 'Experiment'),
      status: String(item.status || 'DRAFT'),
    }))
  } catch {
    return []
  }
}

export function AtrExpReferencePicker({
  value = '',
  readOnly = false,
  onChange,
  onLink,
}: AtrExpReferencePickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  const { data: experiments = [], isLoading } = useQuery({
    queryKey: ['ard-experiments-list'],
    queryFn: fetchExperiments,
    staleTime: 30_000,
  })

  const currentCodes = value
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)

  const addCode = (code: string) => {
    if (!code || currentCodes.includes(code)) return
    const next = [...currentCodes, code].join(', ')
    onChange?.(next)
    const expObj = experiments.find((e) => e.expCode === code)
    if (expObj && onLink) {
      onLink(expObj)
    }
  }

  const removeCode = (codeToRemove: string) => {
    const next = currentCodes.filter((c) => c !== codeToRemove).join(', ')
    onChange?.(next)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-1 border border-slate-200 rounded-lg bg-slate-50/50">
        {currentCodes.length > 0 ? (
          currentCodes.map((code) => (
            <Tag
              key={code}
              color="purple"
              className="flex items-center gap-1 text-xs py-0.5 px-2 rounded-md font-medium border-purple-200 shadow-sm"
              closable={!readOnly}
              onClose={() => removeCode(code)}
            >
              <Link size={12} className="text-purple-600" />
              <span>{code}</span>
            </Tag>
          ))
        ) : (
          <span className="text-xs text-slate-400 italic px-2">
            {readOnly ? '—' : 'No reference experiments linked'}
          </span>
        )}
        {!readOnly && (
          <Button
            size="small"
            type="dashed"
            icon={<Plus size={13} />}
            onClick={() => setOpen(true)}
            className="text-xs text-indigo-600 border-indigo-200 hover:border-indigo-400 flex items-center gap-1 h-6"
          >
            Link Experiment
          </Button>
        )}
      </div>

      <Modal
        {...glassModalProps}
        title={
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-base">
            <Link size={18} className="text-indigo-600" />
            <span>Link Reference Experiment</span>
          </div>
        }
        open={open}
        onCancel={() => {
          setOpen(false)
          setSelectedCode(null)
        }}
        onOk={() => {
          if (selectedCode) addCode(selectedCode)
          setOpen(false)
          setSelectedCode(null)
        }}
        okButtonProps={{
          disabled: !selectedCode,
          className: 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-none',
        }}
        destroyOnClose
      >
        <Space direction="vertical" className="w-full mt-2">
          <Text type="secondary" className="text-xs text-slate-500">
            Select an active notebook experiment to reference in this ATR:
          </Text>
          <Select
            showSearch
            className="w-full"
            placeholder={isLoading ? 'Loading experiments...' : 'Search by code or title...'}
            loading={isLoading}
            optionFilterProp="label"
            value={selectedCode}
            onChange={setSelectedCode}
            options={experiments.map((exp) => ({
              value: exp.expCode,
              label: `${exp.expCode} — ${exp.title} (${exp.status})`,
            }))}
          />
        </Space>
      </Modal>
    </div>
  )
}
