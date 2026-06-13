import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Table, Button, Input, Tabs, Tag, Spin, message,
  Modal, Form, Popconfirm, Upload, Timeline,
  Checkbox, Radio, Dropdown, Switch, Select, DatePicker,
} from 'antd';
import {
  HomeOutlined,
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UnlockOutlined,
  SaveOutlined,
  DownOutlined,
  FilePdfOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import Header from '@/common/Header';
import Sidebar from '@/common/Sidebar';
import StatusTag from '@/common/StatusTag';
import RichTextEditor from '@/common/RichTextEditor';
import KetcherEditor, { type KetcherEditorHandle } from '@/common/KetcherEditor';
import ESignatureModal from '@/common/ESignatureModal';
import { useCRDSettings } from '@/common/CRDSettingsContext';
import styles from './styles.module.less';
import {
  getExperiment,
  updateExperiment,
  submitExperiment,
  signExperiment,
  approveExperiment,
  rejectExperiment,
  createUnlockRequest,
  getATRs,
  createATR,
  type ATRSummary,
  getExperimentHistory,
  uploadExperimentAttachment,
  deleteExperimentAttachment,
  exportExperimentPDF,
  type ExportPDFParams,
  type ExperimentResponse,
  type ExperimentAttachmentResponse,
  type HistoryResponse,
  getNotebook,
  getWorkflowTemplate,
} from '@/utilities/chemiaApi';

// -- Inline template types -----------------------------------------------------
type TmplField  = { key: string; label: string; type: string; required: boolean; placeholder: string; options: string[] }
type TmplScreen = { key: string; title: string; persona: string; has_signature: boolean; has_files: boolean; fields: TmplField[] }
type TmplSection= { key: string; title: string; screens: TmplScreen[] }
type TmplDef    = { sections: TmplSection[] }

const { TabPane } = Tabs;

// """ Status helpers """""""""""""""""""""""""""""""""""""""""""""""""""""""""""

const isEditable = (status: string) =>
  status === 'DRAFT' ||
  status === 'INPROGRESS' ||
  status === 'REJECTED' ||
  status === 'REWORK';

// """ Current user helper """"""""""""""""""""""""""""""""""""""""""""""""""""""

const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('chemia_user') ?? '{}'); } catch { return {}; }
};

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

const ExperimentEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const storedUser      = getStoredUser();
  const currentUserRole: string = storedUser?.role ?? '';
  const canApprove  = currentUserRole === 'QA'  || currentUserRole === 'HOD';
  const canVerify   = currentUserRole === 'TL'  || canApprove;

  // "" Core state """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
  const [exp, setExp]         = useState<ExperimentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Ketcher ref --- kept per product requirement
  const ketcherRef = React.useRef<KetcherEditorHandle>(null);

  // "" Draft fields """""""""""""""""""""""""""""""""""""""""""""""""""""""""
  const [draftTitle,       setDraftTitle]       = useState('');
  const [draftObs,         setDraftObs]         = useState('');
  const [draftConclusion,  setDraftConclusion]  = useState('');
  const [draftData,        setDraftData]        = useState<Record<string, unknown>>({});

  // Linked template  loaded from localStorage via notebook_id ? template_id
  const [linkedScreen,       setLinkedScreen]       = useState<TmplScreen | null>(null);
  const [linkedSectionTitle, setLinkedSectionTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState('summary');

  const [atrRows,     setAtrRows]     = useState<ATRSummary[]>([]);
  const [attachments, setAttachments] = useState<ExperimentAttachmentResponse[]>([]);
  const [history,     setHistory]     = useState<HistoryResponse[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // "" Modals """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
  const [rejectOpen, setRejectOpen]         = useState(false);
  const [rejectForm]                        = Form.useForm();
  const [singlePage, setSinglePage]         = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) => setCollapsedSections(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const [addATROpen, setAddATROpen]         = useState(false);
  const [addATRForm]                        = Form.useForm();
  const [unlockReqOpen, setUnlockReqOpen]   = useState(false);
  const [unlockReqForm]                     = Form.useForm();
  const [unlockReqLoading, setUnlockReqLoading] = useState(false);

  // v2: Save-comments modal
  const [saveCommentsOpen,  setSaveCommentsOpen]  = useState(false);
  const [saveCommentsForm]                        = Form.useForm();

  // "" CRD settings (for e-signature gates) """"""""""""""""""""""""""""""""
  const crdSettings = useCRDSettings();

  // "" E-signature modal state """"""""""""""""""""""""""""""""""""""""""""""
  const [eSignOpen,  setESignOpen]  = useState(false);
  const [eSignLabel, setESignLabel] = useState('');
  // Stores the pending action; called with the password when the user confirms.
  const eSignFnRef = useRef<((pw: string) => Promise<void>) | null>(null);

  // v2: PDF export
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<ExportPDFParams>({
    include_inputs:     true,
    include_parameters: true,
    include_steps:      true,
    include_equipment:  true,
    include_tlc:        true,
    include_comments:   false,
  });


  // Scheme sidebar (structure tools)
  const [schemeInputType,       setSchemeInputType]       = useState<'smiles' | 'name'>('smiles');
  const [schemeInputText,       setSchemeInputText]       = useState('');
  const [schemeConvertLoading,  setSchemeConvertLoading]  = useState(false);
  const [schemeRecogLoading,    setSchemeRecogLoading]    = useState(false);

  // "" Load experiment """"""""""""""""""""""""""""""""""""""""""""""""""""""
  const loadExp = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getExperiment(id)
      .then(e => {
        setExp(e);
        setDraftTitle(e.title ?? '');
        setDraftObs(e.observations ?? '');
        setDraftConclusion(e.conclusion ?? '');
        setDraftData((e.data ?? {}) as Record<string, unknown>);
        setAttachments(e.files ?? []);
        getATRs({ experiment_id: id, page_size: 100 })
          .then(r => setAtrRows(r.items))
          .catch(() => {});

        // Load linked template from notebook (API) with localStorage fallback
        if (e.notebook_id && e.screen_key) {
          getNotebook(e.notebook_id).then(nb => {
            const tmplId = nb.template_id ?? localStorage.getItem(`chemia_nb_tmpl_${e.notebook_id}`);
            if (!tmplId) return;
            getWorkflowTemplate(tmplId).then(tmpl => {
              const def = tmpl.definition as TmplDef | undefined;
              for (const section of def?.sections ?? []) {
                const screen = section.screens?.find(sc => sc.key === e.screen_key);
                if (screen) {
                  setLinkedScreen(screen);
                  setLinkedSectionTitle(section.title);
                  break;
                }
              }
            }).catch(() => {});
          }).catch(() => {});
        }
      })
      .catch(() => message.error('Failed to load experiment'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadExp(); }, [loadExp]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (linkedScreen && !searchParams.get('tab')) setActiveTab('workflow');
  }, [linkedScreen, searchParams]);

  const loadHistory = () => {
    if (!id) return;
    setHistLoading(true);
    getExperimentHistory(id)
      .then(h => setHistory(h))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  };

  // "" E-signature helper """"""""""""""""""""""""""""""""""""""""""""""""""""
  /**
   * Run an action that may require e-signature confirmation.
   * If `reauthRequired` is true: store the callback in eSignFnRef and open the
   * ESignatureModal; the modal will call the fn with the user's password.
   * If false: execute immediately (catching errors for message.error display).
   *
   * The `fn` receives an optional password and returns a Promise<ExperimentResponse>.
   * On success it should call setExp(updated) and show a success toast.
   * On failure it MUST throw so the modal can display the inline error.
   */
  const triggerWithESign = (
    label: string,
    reauthRequired: boolean,
    fn: (pw?: string) => Promise<void>,
  ) => {
    if (reauthRequired) {
      eSignFnRef.current = async (pw: string) => {
        await fn(pw);
        setESignOpen(false);
      };
      setESignLabel(label);
      setESignOpen(true);
    } else {
      fn().catch(err =>
        message.error(err instanceof Error ? err.message : `Failed: ${label}`)
      );
    }
  };

  // "" Save (opens save-comments modal first, then optional e-sign) """""""""
  const handleSaveClick = () => {
    saveCommentsForm.resetFields();
    setSaveCommentsOpen(true);
  };

  const handleSaveConfirm = async (_values: { save_comments?: string }) => {
    if (!id || !exp) return;

    // Collect Ketcher MOL now (async --- must happen before closing the modal)
    const schemeMol = ketcherRef.current
      ? await ketcherRef.current.getMol()
      : undefined;

    const body = {
      title:        draftTitle        || undefined,
      observations: draftObs          || undefined,
      conclusion:   draftConclusion   || undefined,
      scheme_mol:   schemeMol         || null,
      data:         Object.keys(draftData).length > 0 ? draftData : undefined,
    };

    setSaveCommentsOpen(false);

    // Core save operation --- throws on failure (for e-sign modal to catch)
    const doSave = async (pw?: string) => {
      setSaving(true);
      try {
        const updated = await updateExperiment(id, body, pw);
        setExp(updated);
        message.success('Saved');
      } finally {
        setSaving(false);
      }
    };

    triggerWithESign('Save Draft', crdSettings?.reauth_save ?? false, doSave);
  };

  // "" PDF Export """""""""""""""""""""""""""""""""""""""""""""""""""""""""""
  const handleExportPDF = async () => {
    if (!id || !exp) return;
    setPdfExporting(true);
    try {
      const blob = await exportExperimentPDF(id, pdfOptions);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${exp.full_code}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success('Report downloaded');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setPdfExporting(false);
    }
  };

  // "" Workflow actions """""""""""""""""""""""""""""""""""""""""""""""""""""

  /**
   * Run a workflow action, updating exp state and showing toasts.
   * Errors are caught here and shown as message.error (NOT re-thrown).
   * Use doActionRaw when you need errors to propagate (e.g. e-sign modal).
   */
  const doAction = async (label: string, fn: () => Promise<ExperimentResponse>) => {
    setActionLoading(label);
    try {
      const updated = await fn();
      setExp(updated);
      message.success(`${label} successful`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : `Failed: ${label}`);
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Like doAction but errors propagate --- used with the e-sign modal so that a
   * wrong-password 403 surfaces as an inline error rather than a toast.
   */
  const doActionRaw = async (label: string, fn: () => Promise<ExperimentResponse>) => {
    setActionLoading(label);
    try {
      const updated = await fn();
      setExp(updated);
      message.success(`${label} successful`);
    } finally {
      setActionLoading(null);
    }
    // errors intentionally propagate to the caller
  };

  const handleSubmit = () =>
    triggerWithESign(
      'Submit for Verification',
      crdSettings?.reauth_submit_for_verification ?? false,
      (pw) => doActionRaw('Submit', () => submitExperiment(id!, pw)),
    );

  const handleVerify = () =>
    triggerWithESign(
      'Verify',
      crdSettings?.reauth_verification ?? false,
      (pw) => doActionRaw('Verify', () => signExperiment(id!, pw)),
    );

  const handleApprove = () => doAction('Approve', () => approveExperiment(id!));
  const handleRequestUnlock = async (values: { reason: string }) => {
    if (!id) return;
    setUnlockReqLoading(true);
    try {
      await createUnlockRequest({ experiment_id: id, reason: values.reason });
      message.success('Unlock request submitted --- awaiting QA review');
      setUnlockReqOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to submit unlock request');
    } finally {
      setUnlockReqLoading(false);
    }
  };

  const handleReject = async (values: { reason: string }) => {
    setActionLoading('Reject');
    try {
      const updated = await rejectExperiment(id!, values.reason);
      setExp(updated);
      message.success('Rejected');
      setRejectOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };


  // -- ATR --------------------------------------------------------------------
  const handleAddATR = async (values: Record<string, unknown>) => {
    try {
      const atr = await createATR({
        experiment_id: id!,
        test_type:  values.test_type as string,
        objectives: values.objectives as string,
        due_date:   values.due_date ? (values.due_date as { format: (f: string) => string }).format('YYYY-MM-DD') : undefined,
      });
      setAtrRows(prev => [...prev, atr as unknown as ATRSummary]);
      addATRForm.resetFields();
      setAddATROpen(false);
      message.success('ATR raised successfully');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to raise ATR');
    }
  };

  // "" Attachments """"""""""""""""""""""""""""""""""""""""""""""""""""""""""
  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      const doUpload = async (pw?: string) => {
        const att = await uploadExperimentAttachment(id!, file, pw);
        setAttachments(prev => [...prev, att]);
        message.success(`${file.name} uploaded`);
      };

      if (crdSettings?.reauth_attachment_upload) {
        eSignFnRef.current = async (pw: string) => {
          await doUpload(pw);
          setESignOpen(false);
        };
        setESignLabel('Attachment Upload');
        setESignOpen(true);
      } else {
        doUpload().catch(err =>
          message.error(err instanceof Error ? err.message : 'Upload failed')
        );
      }
      return false; // prevent antd from doing its own upload
    },
    showUploadList: false,
  };

  const handleDeleteAttachment = async (attId: string) => {
    try {
      await deleteExperimentAttachment(id!, attId);
      setAttachments(prev => prev.filter(a => a.id !== attId));
      message.success('Attachment deleted');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  // "" Columns """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
  const editable = exp ? isEditable(exp.status) : false;

  const atrColumns: ColumnsType<ATRSummary> = [
    { title: 'ATR No',     dataIndex: 'atr_no',    key: 'atr_no',    width: 130 },
    { title: 'Test Type',  dataIndex: 'test_type', key: 'test_type', width: 100 },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <StatusTag status={v} />,
    },
    { title: 'Due Date',   dataIndex: 'due_date',  key: 'due_date',  width: 110, render: (v) => v ?? '---' },
    { title: 'Raised',     dataIndex: 'raised_at', key: 'raised_at', width: 110, render: (v) => v?.slice(0, 10) },
  ];

  const attachColumns: ColumnsType<ExperimentAttachmentResponse> = [
    { title: 'File Name', dataIndex: 'filename',    key: 'filename' },
    { title: 'Type',      dataIndex: 'file_type',   key: 'file_type',  width: 80,  render: (v) => v ? String(v).toUpperCase() : '---' },
    { title: 'Size',      dataIndex: 'file_size',   key: 'file_size',  width: 100, render: (v) => v ? `${Math.round(Number(v) / 1024)} KB` : '---' },
    { title: 'Uploaded',  dataIndex: 'uploaded_at', key: 'uploaded_at', width: 110, render: (v) => v?.slice(0, 10) },
    {
      title: 'Actions', key: 'actions', width: 72,
      render: (_: unknown, record: ExperimentAttachmentResponse) => (
        <Popconfirm title="Delete this attachment?" onConfirm={() => handleDeleteAttachment(record.id)}
          okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" icon={<DeleteOutlined />} danger type="text" />
        </Popconfirm>
      ),
    },
  ];

  // "" Loading / not found """""""""""""""""""""""""""""""""""""""""""""""""""
  if (loading) return (
    <div className={styles.page}>
      <Header />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    </div>
  );

  if (!exp) return null;

  const needsVerify = exp.status === 'SUBMITTED' || exp.status === 'VERIFICATION REQUESTED';

  // "" Render """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="experiments" />
        <main className={styles.main}>

          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}>
              <HomeOutlined style={{ marginRight: 4 }} />Home
            </span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span className={styles.breadcrumbLink} onClick={() => navigate('/experiments')}>
              Experiments
            </span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span>{exp.full_code}</span>
          </div>

          {/* "" Header card "" */}
          <div className={styles.headerCard}>
            <div className={styles.headerTop}>
              <div className={styles.headerLeft}>
                <span className={styles.experimentCode}>{exp.full_code}</span>

                <StatusTag status={exp.status} />

                <div className={styles.pageViewToggle}>
                  <Switch
                    size="small"
                    checked={singlePage}
                    onChange={v => { setSinglePage(v); if (v) loadHistory(); }}
                  />
                  <span className={styles.pageViewLabel}>Page view</span>
                </div>

                {/* v2: version badge */}
                {exp.version && exp.version > 1 && (
                  <Tag color="purple" style={{ fontSize: 11 }}>v{exp.version}</Tag>
                )}
              </div>

              <div className={styles.headerRight}>
                {/* Save */}
                {editable && (
                  <Button className={styles.saveBtn} size="small" icon={<SaveOutlined />}
                    loading={saving} onClick={handleSaveClick}>
                    Save
                  </Button>
                )}

                {/* Submit (DRAFT / INPROGRESS) */}
                {(exp.status === 'DRAFT' || exp.status === 'INPROGRESS') && (
                  <Popconfirm title="Submit for verification?" onConfirm={handleSubmit} okText="Submit">
                    <Button className={styles.submitBtn} size="small" icon={<SendOutlined />}
                      loading={actionLoading === 'Submit'}>
                      Submit for Verification
                    </Button>
                  </Popconfirm>
                )}

                {/* Re-submit after REWORK */}
                {exp.status === 'REWORK' && (
                  <Popconfirm title="Re-submit for verification after rework?" onConfirm={handleSubmit} okText="Re-submit">
                    <Button className={styles.submitBtn} size="small" icon={<SendOutlined />}
                      loading={actionLoading === 'Submit'}>
                      Re-submit
                    </Button>
                  </Popconfirm>
                )}

                {/* Verify / Reject (SUBMITTED or VERIFICATION REQUESTED) */}
                {needsVerify && canVerify && (
                  <>
                    <Button size="small" icon={<CheckCircleOutlined />}
                      style={{ borderColor: '#4a9290', color: '#4a9290' }}
                      loading={actionLoading === 'Verify'} onClick={handleVerify}>
                      Verify
                    </Button>
                    <Button size="small" danger icon={<CloseCircleOutlined />}
                      loading={actionLoading === 'Reject'}
                      onClick={() => { rejectForm.resetFields(); setRejectOpen(true); }}>
                      Reject
                    </Button>
                  </>
                )}

                {/* Approve / Reject (VERIFIED) */}
                {exp.status === 'VERIFIED' && canApprove && (
                  <>
                    <Button size="small" icon={<CheckCircleOutlined />}
                      style={{ borderColor: '#047857', color: '#047857' }}
                      loading={actionLoading === 'Approve'} onClick={handleApprove}>
                      Approve
                    </Button>
                    <Button size="small" danger icon={<CloseCircleOutlined />}
                      loading={actionLoading === 'Reject'}
                      onClick={() => { rejectForm.resetFields(); setRejectOpen(true); }}>
                      Reject
                    </Button>
                  </>
                )}

                {/* Request Unlock (APPROVED) */}
                {exp.status === 'APPROVED' && (
                  <Button size="small" icon={<UnlockOutlined />}
                    onClick={() => { unlockReqForm.resetFields(); setUnlockReqOpen(true); }}>
                    Request Unlock
                  </Button>
                )}

                {/* Export PDF --- always visible */}
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  dropdownRender={() => (
                    <div style={{
                      background: '#fff',
                      border: '1px solid #e7e5e4',
                      borderRadius: 8,
                      padding: '12px 16px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                      minWidth: 220,
                    }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: '#78716c',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        marginBottom: 10,
                      }}>
                        Include in Report
                      </div>
                      {(
                        [
                          ['include_inputs',     'Inputs / Reagents'],
                          ['include_parameters', 'Parameters'],
                          ['include_steps',      'Procedure Steps'],
                          ['include_equipment',  'Equipment Used'],
                          ['include_tlc',        'TLC Entries'],
                          ['include_comments',   'Comments'],
                        ] as [keyof ExportPDFParams, string][]
                      ).map(([key, label]) => (
                        <div key={key} style={{ marginBottom: 6 }}>
                          <Checkbox
                            checked={!!pdfOptions[key]}
                            onChange={e =>
                              setPdfOptions(prev => ({ ...prev, [key]: e.target.checked }))
                            }
                          >
                            <span style={{ fontSize: 13 }}>{label}</span>
                          </Checkbox>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid #e7e5e4', marginTop: 10, paddingTop: 10 }}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<DownloadOutlined />}
                          loading={pdfExporting}
                          onClick={handleExportPDF}
                          style={{ width: '100%', background: '#5aa3a1', borderColor: '#5aa3a1' }}
                        >
                          Download PDF
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  <Button
                    size="small"
                    icon={<FilePdfOutlined />}
                    loading={pdfExporting}
                    style={{ borderColor: '#5aa3a1', color: '#5aa3a1' }}
                  >
                    Export Report
                  </Button>
                </Dropdown>
              </div>
            </div>

            {/* Meta row */}
            <div className={styles.metaRow}>
              <div className={styles.metaItem}>
                Created by: <span>{exp.creator?.full_name ?? exp.created_by}</span>
              </div>
              <div className={styles.metaItem}>
                Date: <span>{exp.created_at?.slice(0, 10)}</span>
              </div>
              {exp.approved_by && (
                <div className={styles.metaItem}>
                  Approved by: <span>{exp.approved_by}</span>
                </div>
              )}
            </div>

            {/* v2: Rejection reason inline */}
            {exp.rejection_reason && (
              <div className={styles.rejectionBanner}>
                <CloseCircleOutlined style={{ marginRight: 6, color: '#be123c' }} />
                <strong>Rejected:</strong>&nbsp;{exp.rejection_reason}
              </div>
            )}

          </div>

          {/* "" Tabs card "" */}
          <div className={`${styles.tabsCard} ${singlePage ? styles.singlePageTabs : ''}`}>
            <Tabs size="small" tabPosition="top"
              activeKey={activeTab}
              destroyInactiveTabPane={false}
              onChange={key => {
                setActiveTab(key);
                if (key === 'history') loadHistory();
              }}>

              {/* Workflow Fields (only when a template screen is linked) */}
              {linkedScreen && (
                <TabPane
                  forceRender
                  tab={<span>Workflow Fields <Tag color="blue" style={{ fontSize: 10, marginLeft: 4, padding: '0 5px' }}>{linkedScreen.fields.length}</Tag></span>}
                  key="workflow"
                >
                  {singlePage && (
                    <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('workflow')}>
                      <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('workflow') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                      <span>Workflow Fields</span>
                    </div>
                  )}
                  {(!singlePage || !collapsedSections.has('workflow')) && (
                    <div className={styles.tabContent}>
                      {/* Screen header */}
                      <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7 }}>
                        <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                          {linkedSectionTitle}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0c4a6e' }}>{linkedScreen.title}</div>
                        {linkedScreen.persona && (
                          <div style={{ fontSize: 11, color: '#0369a1', marginTop: 3 }}>Persona: {linkedScreen.persona}</div>
                        )}
                      </div>

                      {/* Fields grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px 20px' }}>
                        {linkedScreen.fields.map(field => (
                          <div key={field.key}>
                            <div className={styles.fieldLabel} style={{ marginBottom: 4 }}>
                              {field.label}
                              {field.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                            </div>

                            {field.type === 'text' && (
                              <Input
                                size="small"
                                value={(draftData[field.key] as string) ?? ''}
                                onChange={e => setDraftData(d => ({ ...d, [field.key]: e.target.value }))}
                                placeholder={field.placeholder || ''}
                                readOnly={!editable}
                              />
                            )}

                            {field.type === 'number' && (
                              <Input
                                size="small"
                                type="number"
                                value={(draftData[field.key] as string) ?? ''}
                                onChange={e => setDraftData(d => ({ ...d, [field.key]: e.target.value }))}
                                placeholder={field.placeholder || ''}
                                readOnly={!editable}
                              />
                            )}

                            {field.type === 'textarea' && (
                              <Input.TextArea
                                rows={3}
                                size="small"
                                value={(draftData[field.key] as string) ?? ''}
                                onChange={e => setDraftData(d => ({ ...d, [field.key]: e.target.value }))}
                                placeholder={field.placeholder || ''}
                                readOnly={!editable}
                                style={{ fontSize: 12 }}
                              />
                            )}

                            {field.type === 'select' && (
                              <Select
                                size="small"
                                style={{ width: '100%' }}
                                value={(draftData[field.key] as string) ?? undefined}
                                onChange={v => setDraftData(d => ({ ...d, [field.key]: v }))}
                                placeholder={field.placeholder || 'Select'}
                                disabled={!editable}
                                allowClear
                                options={(field.options ?? []).map(o => ({ value: o, label: o }))}
                              />
                            )}

                            {field.type === 'date' && (
                              <Input
                                size="small"
                                type="date"
                                value={(draftData[field.key] as string) ?? ''}
                                onChange={e => setDraftData(d => ({ ...d, [field.key]: e.target.value }))}
                                readOnly={!editable}
                              />
                            )}

                            {field.type === 'checkbox' && (
                              <Checkbox
                                checked={!!(draftData[field.key])}
                                onChange={e => setDraftData(d => ({ ...d, [field.key]: e.target.checked }))}
                                disabled={!editable}
                                style={{ fontSize: 12 }}
                              >
                                {field.placeholder || field.label}
                              </Checkbox>
                            )}
                          </div>
                        ))}
                      </div>

                      {!editable && (
                        <div style={{ marginTop: 16, fontSize: 12, color: '#78716c', fontStyle: 'italic' }}>
                          This experiment is {exp?.status?.toLowerCase()}  fields are read-only.
                        </div>
                      )}
                    </div>
                  )}
                </TabPane>
              )}

              {/* Summary */}
              <TabPane forceRender tab="Summary" key="summary">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('summary')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('summary') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Summary</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('summary')) && <div className={styles.tabContent}>
                  <div>
                    <div className={styles.fieldLabel}>Title</div>
                    {editable
                      ? <Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} size="small" />
                      : <div className={styles.viewValue}>{draftTitle || '---'}</div>}
                  </div>
                </div>}
              </TabPane>

              {/* Procedure */}
              <TabPane forceRender tab="Procedure" key="procedure">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('procedure')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('procedure') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Procedure</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('procedure')) && <div className={styles.tabContent}>
                  <div>
                    <div className={styles.fieldLabel}>Observations &amp; Results</div>
                    <RichTextEditor value={draftObs} onChange={setDraftObs}
                      readOnly={!editable} placeholder="Record your observations and results..." minHeight={160} />
                  </div>
                </div>}
              </TabPane>

              {/* Scheme --- Ketcher reaction / structure editor (kept per product requirement) */}
              <TabPane tab="Scheme" key="scheme">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('scheme')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('scheme') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Scheme</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('scheme')) && <div className={styles.tabContent}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                    {/* Structure tools sidebar  edit mode only, placed before Ketcher */}
                    {editable && (
                      <div style={{
                        width: 260, flexShrink: 0,
                        border: '1px solid #e7e5e4', borderRadius: 8,
                        background: '#fafaf9', padding: '14px 14px 10px',
                        display: 'flex', flexDirection: 'column', gap: 12,
                        overflowY: 'auto',
                      }}>
                        {/* TEXT INPUT */}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#57534e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                            Text Input
                          </div>
                          <Radio.Group
                            value={schemeInputType}
                            onChange={e => { setSchemeInputType(e.target.value); setSchemeInputText(''); }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}
                          >
                            <Radio value="smiles" style={{ fontSize: 12 }}>SMILES</Radio>
                            <Radio value="name" style={{ fontSize: 12 }}>Chemical Name</Radio>
                          </Radio.Group>
                          <Input
                            size="small"
                            value={schemeInputText}
                            onChange={e => setSchemeInputText(e.target.value)}
                            placeholder={
                              schemeInputType === 'smiles' ? 'e.g. c1ccccc1.CCO' : 'e.g. aspirin'
                            }
                            style={{ marginBottom: 8 }}
                          />
                          <Button
                            size="small" type="primary" block
                            loading={schemeConvertLoading}
                            disabled={!schemeInputText.trim()}
                            onClick={async () => {
                              if (!schemeInputText.trim() || !ketcherRef.current) return;
                              setSchemeConvertLoading(true);
                              try {
                                await ketcherRef.current.loadMol(schemeInputText.trim());
                              } catch {
                                message.error('Could not convert  check the input format');
                              } finally {
                                setSchemeConvertLoading(false);
                              }
                            }}
                          >
                            Convert ?
                          </Button>
                        </div>

                        <div style={{ borderTop: '1px solid #e7e5e4' }} />

                        {/* IMAGE RECOGNITION */}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#57534e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                            Image Recognition (OCSR)
                          </div>
                          <Upload
                            accept="image/*"
                            showUploadList={false}
                            beforeUpload={(file) => {
                              setSchemeRecogLoading(true);
                              ketcherRef.current?.recognizeImage(file)
                                .then(() => message.success('Structure loaded from image'))
                                .catch((err: Error) => message.error(err.message ?? 'Recognition failed'))
                                .finally(() => setSchemeRecogLoading(false));
                              return false;
                            }}
                          >
                            <div style={{
                              border: '1.5px dashed #d6d3d1', borderRadius: 6,
                              padding: '16px 10px', textAlign: 'center',
                              cursor: 'pointer', background: '#fff',
                              color: '#78716c', fontSize: 12,
                            }}>
                              {schemeRecogLoading
                                ? <Spin size="small" />
                                : <>Drop image here<br /><span style={{ color: '#a8a29e' }}>or click to browse</span></>
                              }
                            </div>
                          </Upload>
                        </div>

                      </div>
                    )}

                    {/* Ketcher canvas */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!editable && (
                        <div style={{ marginBottom: 8 }}>
                          <div className={styles.fieldLabel} style={{ margin: 0 }}>Reaction Scheme</div>
                        </div>
                      )}
                      <KetcherEditor
                        ref={ketcherRef}
                        initialMol={exp.scheme_mol}
                        readOnly={!editable}
                      />
                    </div>
                  </div>
                </div>}
              </TabPane>

              {/* Conclusion */}
              <TabPane forceRender tab="Conclusion" key="conclusion">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('conclusion')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('conclusion') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Conclusion</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('conclusion')) && <div className={styles.tabContent}>
                  <div>
                    <div className={styles.fieldLabel}>Conclusion</div>
                    <RichTextEditor value={draftConclusion} onChange={setDraftConclusion}
                      readOnly={!editable} placeholder="Write your conclusion---" minHeight={160} />
                  </div>
                </div>}
              </TabPane>

              {/* ATR */}
              <TabPane forceRender tab={`ATR (${atrRows.length})`} key="atr">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('atr')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('atr') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>ATR</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('atr')) && <div className={styles.tabContent}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className={styles.sectionTitle} style={{ margin: 0 }}>Analysis Test Requests</div>
                      {editable && (
                        <Button className={styles.addBtn} size="small" icon={<PlusOutlined />}
                          onClick={() => { addATRForm.resetFields(); setAddATROpen(true); }}>
                          Raise ATR
                        </Button>
                      )}
                    </div>
                    <Table<ATRSummary> style={{ marginTop: 8 }}
                      className={styles.table}
                      columns={atrColumns}
                      dataSource={atrRows.map(a => ({ ...a, key: a.id }))}
                      size="small" pagination={false}
                      locale={{ emptyText: 'No ATRs raised yet.' }}
                    />
                  </div>
                </div>}
              </TabPane>

              {/* Attachments */}
              <TabPane forceRender tab="Attachments" key="attachments">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('attachments')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('attachments') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Attachments</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('attachments')) && <div className={styles.tabContent}>
                  <Upload {...uploadProps}>
                    <div className={styles.uploadBox}>
                      <UploadOutlined style={{ marginRight: 6 }} />
                      Click to upload a file
                    </div>
                  </Upload>
                  <Table<ExperimentAttachmentResponse>
                    className={styles.table}
                    columns={attachColumns}
                    dataSource={attachments.map(a => ({ ...a, key: a.id }))}
                    size="small" pagination={false}
                    locale={{ emptyText: 'No attachments uploaded yet.' }}
                  />
                </div>}
              </TabPane>

              {/* History */}
              <TabPane forceRender tab="History" key="history">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('history')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('history') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>History</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('history')) && <div className={styles.tabContent}>
                  {histLoading
                    ? <Spin />
                    : history.length === 0
                      ? <p style={{ color: '#78716c', fontSize: 13 }}>No history yet.</p>
                      : (
                        <Timeline
                          items={history.map(h => ({
                            key: h.id,
                            color: h.action === 'APPROVED' ? 'green'
                              : h.action === 'REJECTED' ? 'red'
                              : h.action === 'VERIFIED' ? 'blue'
                              : 'gray',
                            children: (
                              <div style={{ paddingBottom: 4 }}>
                                <strong style={{ fontSize: 13 }}>{h.action}</strong>
                                <span style={{ fontSize: 12, color: '#78716c', marginLeft: 8 }}>
                                  {h.created_at?.slice(0, 16).replace('T', ' ')}
                                </span>
                                <span style={{ fontSize: 12, color: '#57534e', marginLeft: 8 }}>
                                  by {h.actor_id}
                                </span>
                              </div>
                            ),
                          }))}
                        />
                      )
                  }
                </div>}
              </TabPane>

            </Tabs>
          </div>
        </main>
      </div>

      {/* "" E-Signature Modal (v2) "" */}
      <ESignatureModal
        open={eSignOpen}
        actionLabel={eSignLabel}
        onConfirm={async (pw) => {
          if (eSignFnRef.current) await eSignFnRef.current(pw);
        }}
        onCancel={() => {
          setESignOpen(false);
          eSignFnRef.current = null;
        }}
      />

      {/* "" Save Comments Modal (v2) "" */}
      <Modal
        title="Save --- Reason for Changes"
        open={saveCommentsOpen}
        onCancel={() => setSaveCommentsOpen(false)}
        onOk={() => saveCommentsForm.submit()}
        okText="Save"
        confirmLoading={saving}
        destroyOnClose
        width={420}
        className={styles.saveModal}
      >
        <Form form={saveCommentsForm} layout="vertical" onFinish={handleSaveConfirm}
          requiredMark={false} style={{ marginTop: 8 }}>
          <Form.Item name="save_comments" label="Reason for save (optional)">
            <Input.TextArea rows={3}
              placeholder="Briefly describe what you changed (e.g. Updated objective and procedure)---" />
          </Form.Item>
        </Form>
      </Modal>

      {/* "" Reject Modal "" */}
      <Modal title="Reject Experiment" open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        okText="Reject" okButtonProps={{ danger: true }}
        confirmLoading={actionLoading === 'Reject'}
        destroyOnClose width={420}>
        <Form form={rejectForm} layout="vertical" onFinish={handleReject}
          requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="reason" label="Rejection Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Explain why this experiment is being rejected---" />
          </Form.Item>
        </Form>
      </Modal>

      {/* -- Add ATR Modal -- */}
      <Modal title="Raise ATR" open={addATROpen}
        onCancel={() => setAddATROpen(false)}
        onOk={() => addATRForm.submit()}
        okText="Raise" destroyOnClose width={480}
        className={styles.editorModal} style={{ top: 20 }}>
        <Form form={addATRForm} layout="vertical" onFinish={handleAddATR}
          requiredMark={false} style={{ marginTop: 8 }}>
          <Form.Item name="test_type" label="Test Type"
            rules={[{ required: true, message: 'Select a test type' }]}>
            <Select placeholder="Select test type">
              {['NMR', 'HPLC', 'MS', 'IR', 'GC-MS', 'XRD', 'UV-Vis', 'TGA', 'DSC'].map(t => (
                <Select.Option key={t} value={t}>{t}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="objectives" label="Objectives"
            rules={[{ required: true, message: 'Enter objectives' }]}>
            <Input.TextArea rows={3} placeholder="Describe what needs to be analysed..." />
          </Form.Item>
          <Form.Item name="due_date" label="Due Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* "" Request Unlock Modal "" */}
      <Modal title="Request Experiment Unlock" open={unlockReqOpen}
        onCancel={() => setUnlockReqOpen(false)}
        onOk={() => unlockReqForm.submit()}
        okText="Submit Request"
        confirmLoading={unlockReqLoading}
        destroyOnClose width={420}>
        <Form form={unlockReqForm} layout="vertical" onFinish={handleRequestUnlock}
          requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="reason" label="Reason for Unlock"
            rules={[{ required: true, message: 'Please provide a reason' }]}>
            <Input.TextArea rows={3}
              placeholder="Explain why this approved experiment needs to be unlocked for editing---" />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

export default ExperimentEditorPage;

