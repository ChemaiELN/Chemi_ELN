import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Form, Input, InputNumber, Switch, Button, message,
  Divider, Card, Row, Col,
} from 'antd'
import { Shield, Mail, FlaskConical, Image, Lock } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { ApiError } from '../../api/client'
import BrandSpinner from '../../components/ui/BrandSpinner'

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card
      title={
        <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
          <span className="text-purple-500">{icon}</span>
          {title}
        </div>
      }
      className="glass-card rounded-lg border-0 shadow-none"
      styles={{ header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.5)', minHeight: 44 }, body: { paddingTop: 16 } }}
    >
      {children}
    </Card>
  )
}

// Fields sit inside a card that itself may only be half the viewport wide
// (see the xl:grid-cols-2 page layout below), so columns are sized off the
// card, not the viewport: 2-up as soon as there's room, never squeezed to 3.
const colLayout = { xs: 24, sm: 12 }

export default function SettingsPage() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminApi.getSettings,
  })

  useEffect(() => {
    if (data) {
      form.setFieldsValue({
        ...data,
        smtp_password: '',  // never pre-fill password
      })
    }
  }, [data, form])

  const save = useMutation({
    mutationFn: adminApi.updateSettings,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-settings'] }); msg.success('Settings saved.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save settings.'),
  })

  const onFinish = (values: Record<string, unknown>) => {
    const payload = { ...values }
    if (!payload.smtp_password) delete payload.smtp_password
    save.mutate(payload as Parameters<typeof adminApi.updateSettings>[0])
  }

  if (isLoading) return <div className="p-6 h-[60vh]"><BrandSpinner fullScreen={false} label="Loading settings…" /></div>

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {ctx}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Global Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">System-wide configuration</p>
        </div>
        <Button
          type="primary"
          onClick={() => form.submit()}
          loading={save.isPending}
          className="rounded-md font-medium w-full sm:w-auto"
          size="middle"
        >
          Save Changes
        </Button>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

        {/* Security */}
        <SectionCard icon={<Shield size={15} />} title="Security">
          <Row gutter={[16, 0]}>
            <Col {...colLayout}>
              <Form.Item name="lock_user_after_x_attempts" label="Lock after N failed attempts">
                <InputNumber min={1} max={20} className="w-full rounded-md" />
              </Form.Item>
            </Col>
            <Col {...colLayout}>
              <Form.Item name="password_expiry_days" label="Password expiry (days)">
                <InputNumber min={0} max={365} className="w-full rounded-md" />
              </Form.Item>
            </Col>
            <Col {...colLayout}>
              <Form.Item name="qa_role" label="QA role code">
                <Input placeholder="QA" className="rounded-md" />
              </Form.Item>
            </Col>
          </Row>
        </SectionCard>

        {/* File Limits */}
        <SectionCard icon={<Image size={15} />} title="File Limits">
          <Row gutter={[16, 0]}>
            <Col {...colLayout}>
              <Form.Item name="max_image_kb" label="Max image size (KB)">
                <InputNumber min={128} max={10240} className="w-full rounded-md" />
              </Form.Item>
            </Col>
            <Col {...colLayout}>
              <Form.Item name="max_attachment_kb" label="Max attachment size (KB)">
                <InputNumber min={1024} max={204800} className="w-full rounded-md" />
              </Form.Item>
            </Col>
            <Col {...colLayout}>
              <Form.Item name="search_limit" label="Search result limit">
                <InputNumber min={10} max={500} className="w-full rounded-md" />
              </Form.Item>
            </Col>
          </Row>
        </SectionCard>

        {/* ELN Limits */}
        <SectionCard icon={<FlaskConical size={15} />} title="ELN Limits">
          <Row gutter={[16, 0]}>
            <Col {...colLayout}>
              <Form.Item name="experiments_per_notebook" label="Experiments per notebook">
                <InputNumber min={1} max={9999} className="w-full rounded-md" />
              </Form.Item>
            </Col>
            <Col {...colLayout}>
              <Form.Item name="notebooks_per_project" label="Notebooks per project">
                <InputNumber min={1} max={9999} className="w-full rounded-md" />
              </Form.Item>
            </Col>
          </Row>
        </SectionCard>

        {/* Email / SMTP */}
        <SectionCard icon={<Mail size={15} />} title="Email & Notifications">
          <Form.Item name="enable_email_notifications" valuePropName="checked" label="Enable email notifications">
            <Switch />
          </Form.Item>
          <Divider className="my-3" />
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="smtp_host" label="SMTP host">
                <Input placeholder="smtp.gmail.com" className="rounded-md" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="smtp_port" label="SMTP port">
                <InputNumber min={1} max={65535} className="w-full rounded-md" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="smtp_from_address" label="From address">
                <Input placeholder="noreply@laurus.com" className="rounded-md" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="smtp_username" label="SMTP username">
                <Input className="rounded-md" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="smtp_password" label="SMTP password (leave blank to keep current)">
                <Input.Password
                  placeholder="••••••••"
                  className="rounded-md"
                  iconRender={(visible) => visible ? <Lock size={13} /> : <Lock size={13} />}
                />
              </Form.Item>
            </Col>
          </Row>
        </SectionCard>

      </div>
      </Form>
    </div>
  )
}
