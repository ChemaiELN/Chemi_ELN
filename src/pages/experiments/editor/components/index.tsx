import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Table, Button, Input, Tabs, Tag, Spin, message,
  Modal, Form, Popconfirm, Upload, Timeline, Tooltip, Alert,
  AutoComplete, Checkbox, Radio, Dropdown, Switch,
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
  HistoryOutlined,
  SaveOutlined,
  StarFilled,
  InfoCircleOutlined,
  WarningOutlined,
  LinkOutlined,
  EditOutlined,
  UpOutlined,
  DownOutlined,
  PaperClipOutlined,
  FilePdfOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import Header from '@/common/Header';
import Sidebar from '@/common/Sidebar';
import RichTextEditor from '@/common/RichTextEditor';
import KetcherEditor, { type KetcherEditorHandle } from '@/common/KetcherEditor';
import ESignatureModal from '@/common/ESignatureModal';
import { useCRDSettings } from '@/common/CRDSettingsContext';
import styles from './styles.module.less';
import {
  getExperiment,
  updateExperiment,
  submitExperiment,
  verifyExperiment,
  approveExperiment,
  rejectExperiment,
  reviseExperiment,
  voidExperiment,
  createUnlockRequest,
  addExperimentInput,
  deleteExperimentInput,
  addExperimentParameter,
  deleteExperimentParameter,
  addExperimentTLC,
  updateExperimentInput,
  updateExperimentParameter,
  getExperimentHistory,
  uploadExperimentAttachment,
  deleteExperimentAttachment,
  getChemicals,
  addExperimentStep,
  updateExperimentStep,
  deleteExperimentStep,
  uploadExperimentStepAttachment,
  addExperimentEquipment,
  deleteExperimentEquipment,
  exportExperimentPDF,
  type ExportPDFParams,
  type ExperimentResponse,
  type ExperimentInputResponse,
  type ExperimentParameterResponse,
  type ExperimentTLCResponse,
  type ExperimentAttachmentResponse,
  type HistoryResponse,
  type ExperimentStepResponse,
  type ExperimentEquipmentResponse,
  type LookupChemical,
} from '@/utilities/chemiaApi';

const { TabPane } = Tabs;

// â"€â"€â"€ Status helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const STATUS_CLASS: Record<string, string> = {
  APPROVED:                styles.statusApproved,
  SUBMITTED:               styles.statusSubmitted,
  'VERIFICATION REQUESTED': styles.statusSubmitted,
  VERIFIED:                styles.statusVerified,
  DRAFT:                   styles.statusDraft,
  INPROGRESS:              styles.statusDraft,
  REJECTED:                styles.statusRejected,
  REWORK:                  styles.statusRework,
  UNLOCKED:                styles.statusDraft,
  VOID:                    styles.statusRejected,
};

/** Experiments the chemist can edit */
const isEditable = (status: string) =>
  status === 'DRAFT' ||
  status === 'INPROGRESS' ||
  status === 'REJECTED' ||
  status === 'REWORK';

// â"€â"€â"€ Current user helper â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('chemia_user') ?? '{}'); } catch { return {}; }
};

// â"€â"€â"€ Parameter form fields (shared by Add + Edit modals) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ParameterFormFields({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  const uof   = Form.useWatch('user_entered_or_formula', form) ?? 'USER ENTERED';
  const io    = Form.useWatch('input_output',            form) ?? 'INPUT';
  const isFormula   = uof === 'FORMULA';
  const isOutputFx  = io === 'OUTPUT' && isFormula;   // read-only: calculated by backend

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <Form.Item name="code" label="Code">
          <Input placeholder="e.g. YIELD, MW" style={{ fontFamily: 'monospace' }} />
        </Form.Item>
        <Form.Item name="name" label="Parameter Name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="e.g. Reaction Temperature" />
        </Form.Item>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* INPUT / OUTPUT */}
        <Form.Item name="input_output" label="Direction">
          <Radio.Group buttonStyle="solid" size="small">
            <Radio.Button value="INPUT">INPUT</Radio.Button>
            <Radio.Button value="OUTPUT">OUTPUT</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* Parameter type */}
        <Form.Item name="param_type" label="Data Type">
          <Radio.Group buttonStyle="outline" size="small">
            <Radio.Button value="NUMBER">Number</Radio.Button>
            <Radio.Button value="TEXT">Text</Radio.Button>
            <Radio.Button value="DATE">Date</Radio.Button>
          </Radio.Group>
        </Form.Item>
      </div>

      {/* User Entered vs Formula */}
      <Form.Item name="user_entered_or_formula" label="Source">
        <Radio.Group buttonStyle="solid" size="small">
          <Radio.Button value="USER ENTERED">âœ User Entered</Radio.Button>
          <Radio.Button value="FORMULA">âš™ Formula</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {/* Formula expression --- only when FORMULA selected */}
      {isFormula && (
        <Form.Item
          name="formula_expression"
          label={
            <span>
              Formula Expression&nbsp;
              <Tooltip title="Reference other param codes with {CODE}. E.g. {ACTUAL_YIELD} / {THEO_YIELD} * 100">
                <InfoCircleOutlined style={{ color: '#0f766e' }} />
              </Tooltip>
            </span>
          }
          rules={[{ required: true, message: 'Formula expression is required' }]}
        >
          <Input
            placeholder="e.g. {ACTUAL_YIELD} / {THEO_YIELD} * 100"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
      )}

      {/* Value --- shown for user-entered INPUT only; OUTPUT formula is read-only */}
      {!isFormula && (
        <Form.Item
          name="parameter_value"
          label={io === 'OUTPUT' ? 'Value (set by formula / system)' : 'Value'}
        >
          <Input
            disabled={io === 'OUTPUT'}
            placeholder={io === 'OUTPUT' ? 'Calculated automatically' : 'e.g. 85'}
          />
        </Form.Item>
      )}

      {isOutputFx && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #a7f3d0',
          borderRadius: 6, padding: '8px 12px', marginTop: -8, marginBottom: 12,
          fontSize: 12, color: '#047857',
        }}>
          â„¹ OUTPUT + FORMULA parameters are calculated by the backend and are read-only here.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <Form.Item name="uom" label="Unit of Measure">
          <Input placeholder="e.g. Â°C, %, mol/L" />
        </Form.Item>
        <Form.Item name="remarks" label="Remarks">
          <Input placeholder="Optional notes about this parameter" />
        </Form.Item>
      </div>
    </>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const ExperimentEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();

  const storedUser      = getStoredUser();
  const currentUserRole: string = storedUser?.role ?? '';
  const canApprove  = currentUserRole === 'QA'  || currentUserRole === 'HOD';
  const canVerify   = currentUserRole === 'TL'  || canApprove;

  // â"€â"€ Core state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [exp, setExp]         = useState<ExperimentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Ketcher ref --- kept per product requirement
  const ketcherRef = React.useRef<KetcherEditorHandle>(null);

  // â"€â"€ Draft fields â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [draftTitle,       setDraftTitle]       = useState('');
  const [draftAim,         setDraftAim]         = useState('');
  const [draftObjective,   setDraftObjective]   = useState('');
  const [draftPrecautions, setDraftPrecautions] = useState('');   // v2 new
  const [draftProcedure,   setDraftProcedure]   = useState('');
  const [draftObs,         setDraftObs]         = useState('');
  const [draftConclusion,  setDraftConclusion]  = useState('');
  const [draftStarting,    setDraftStarting]    = useState('');
  const [draftTarget,      setDraftTarget]      = useState('');
  const [draftReaction,    setDraftReaction]    = useState('');
  const [draftTheoYield,   setDraftTheoYield]   = useState('');
  const [draftActYield,    setDraftActYield]    = useState('');
  const [draftYieldPct,    setDraftYieldPct]    = useState('');

  // â"€â"€ Sub-resource state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [inputs,      setInputs]      = useState<ExperimentInputResponse[]>([]);
  const [params,      setParams]      = useState<ExperimentParameterResponse[]>([]);
  const [tlcRows,     setTlcRows]     = useState<ExperimentTLCResponse[]>([]);
  const [attachments, setAttachments] = useState<ExperimentAttachmentResponse[]>([]);
  const [history,     setHistory]     = useState<HistoryResponse[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  // v2: Steps & Equipment
  const [steps,       setSteps]       = useState<ExperimentStepResponse[]>([]);
  const [equipment,   setEquipment]   = useState<ExperimentEquipmentResponse[]>([]);

  // â"€â"€ Modals â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [rejectOpen, setRejectOpen]         = useState(false);
  const [rejectForm]                        = Form.useForm();
  const [addInputOpen, setAddInputOpen]     = useState(false);
  const [addInputForm]                      = Form.useForm();
  const [singlePage, setSinglePage]         = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) => setCollapsedSections(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const [addParamOpen, setAddParamOpen]     = useState(false);
  const [addParamForm]                      = Form.useForm();
  const [editParamOpen, setEditParamOpen]   = useState(false);
  const [editParamForm]                     = Form.useForm();
  const [editingParam, setEditingParam]     = useState<ExperimentParameterResponse | null>(null);
  const [addTLCOpen, setAddTLCOpen]         = useState(false);
  const [addTLCForm]                        = Form.useForm();
  const [unlockReqOpen, setUnlockReqOpen]   = useState(false);
  const [unlockReqForm]                     = Form.useForm();
  const [unlockReqLoading, setUnlockReqLoading] = useState(false);

  // v2: Save-comments modal
  const [saveCommentsOpen,  setSaveCommentsOpen]  = useState(false);
  const [saveCommentsForm]                        = Form.useForm();

  // â"€â"€ CRD settings (for e-signature gates) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const crdSettings = useCRDSettings();

  // â"€â"€ E-signature modal state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // v2: Edit input modal + extra-column toggle + chemical auto-lookup
  const [editInputOpen,  setEditInputOpen]  = useState(false);
  const [editInputForm]                     = Form.useForm();
  const [editingInput,   setEditingInput]   = useState<ExperimentInputResponse | null>(null);
  const [showExtraCols,  setShowExtraCols]  = useState(false);
  const [chemSuggestions, setChemSuggestions] = useState<LookupChemical[]>([]);
  const chemSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // v2: Step modals
  const [addStepOpen,  setAddStepOpen]   = useState(false);
  const [addStepForm]                    = Form.useForm();
  const [editStepOpen, setEditStepOpen]  = useState(false);
  const [editStepForm]                   = Form.useForm();
  const [editingStep,  setEditingStep]   = useState<ExperimentStepResponse | null>(null);
  const [stepAttachLoading, setStepAttachLoading] = useState<string | null>(null);

  // v2: Equipment modal
  const [addEquipOpen, setAddEquipOpen] = useState(false);
  const [addEquipForm]                  = Form.useForm();

  // â"€â"€ Load experiment â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const loadExp = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getExperiment(id)
      .then(e => {
        setExp(e);
        setDraftTitle(e.title ?? '');
        setDraftAim(e.aim ?? '');
        setDraftObjective(e.objective ?? '');
        setDraftPrecautions(e.precautions ?? '');      // v2
        setDraftProcedure(e.procedure ?? '');
        setDraftObs(e.observations ?? '');
        setDraftConclusion(e.conclusion ?? '');
        setDraftStarting(e.starting_material ?? '');
        setDraftTarget(e.target_product ?? '');
        setDraftReaction(e.reaction_type ?? '');
        setDraftTheoYield(e.theoretical_yield ?? '');
        setDraftActYield(e.actual_yield ?? '');
        setDraftYieldPct(e.yield_pct ?? '');
        setInputs(e.inputs ?? []);
        setParams(e.parameters ?? []);
        setTlcRows(e.tlc_records ?? []);
        setAttachments(e.attachments ?? []);
        setSteps([...(e.steps ?? [])].sort((a, b) => a.step_no - b.step_no));
        setEquipment(e.equipment ?? []);
      })
      .catch(() => message.error('Failed to load experiment'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadExp(); }, [loadExp]);

  const loadHistory = () => {
    if (!id) return;
    setHistLoading(true);
    getExperimentHistory(id)
      .then(h => setHistory(h))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  };

  // â"€â"€ E-signature helper â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ Save (opens save-comments modal first, then optional e-sign) â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const handleSaveClick = () => {
    saveCommentsForm.resetFields();
    setSaveCommentsOpen(true);
  };

  const handleSaveConfirm = async (values: { save_comments?: string }) => {
    if (!id || !exp) return;

    // Collect Ketcher MOL now (async --- must happen before closing the modal)
    const schemeMol = ketcherRef.current
      ? await ketcherRef.current.getMol()
      : undefined;

    const body = {
      title:             draftTitle             || undefined,
      aim:               draftAim               || undefined,
      objective:         draftObjective         || undefined,
      precautions:       draftPrecautions       || undefined,    // v2
      procedure:         draftProcedure         || undefined,
      observations:      draftObs               || undefined,
      conclusion:        draftConclusion        || undefined,
      starting_material: draftStarting          || undefined,
      target_product:    draftTarget            || undefined,
      reaction_type:     draftReaction          || undefined,
      scheme_mol:        schemeMol              || null,         // deprecated, backend ignores
      theoretical_yield: draftTheoYield         || undefined,
      actual_yield:      draftActYield          || undefined,
      yield_pct:         draftYieldPct          || undefined,
      save_comments:     values.save_comments   || undefined,    // v2
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

  // â"€â"€ PDF Export â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ Workflow actions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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
      (pw) => doActionRaw('Verify', () => verifyExperiment(id!, pw)),
    );

  const handleApprove = () => doAction('Approve', () => approveExperiment(id!));
  const handleRevise  = () => doAction('Revise',  () => reviseExperiment(id!));

  const handleVoid = () =>
    triggerWithESign(
      'Void Experiment',
      crdSettings?.reauth_deactivate ?? false,
      (pw) => doActionRaw('Void', () => voidExperiment(id!, pw)),
    );

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

  // â"€â"€ Chemical auto-lookup (debounced) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const handleChemSearch = (query: string, form: ReturnType<typeof Form.useForm>[0]) => {
    if (chemSearchTimer.current) clearTimeout(chemSearchTimer.current);
    if (!query || query.length < 2) { setChemSuggestions([]); return; }
    chemSearchTimer.current = setTimeout(async () => {
      try {
        const res = await getChemicals({ search: query, page_size: 8 });
        setChemSuggestions(res.items ?? []);
        // If exact match auto-fill
        const match = (res.items ?? []).find(
          c => c.chemical_name.toLowerCase() === query.toLowerCase()
        );
        if (match) applyChemicalFill(match, form);
      } catch { /* silently ignore */ }
    }, 350);
  };

  const applyChemicalFill = (chem: LookupChemical, form: ReturnType<typeof Form.useForm>[0]) => {
    form.setFieldsValue({
      cas_no:     chem.cas_no    ?? undefined,
      formula:    chem.formula   ?? undefined,
      mol_weight: chem.mol_wt    ?? undefined,
      density:    chem.density   ?? undefined,
    });
  };

  // â"€â"€ Inputs CRUD â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const buildInputBody = (values: Record<string, string>, sortOrder?: number) => ({
    material_name:     values.material_name,
    cas_no:            values.cas_no            || undefined,
    mol_weight:        values.mol_weight        || undefined,
    quantity:          values.quantity          || undefined,
    unit:              values.unit              || undefined,
    moles:             values.moles             || undefined,
    mole_ratio:        values.mole_ratio        || undefined,
    purity_pct:        values.purity_pct        || undefined,
    role:              values.role              || undefined,
    formula:           values.formula           || undefined,
    batch_lot_no:      values.batch_lot_no      || undefined,
    vendor_name:       values.vendor_name       || undefined,
    batch_no:          values.batch_no          || undefined,
    available_qty:     values.available_qty     || undefined,
    required_qty:      values.required_qty      || undefined,
    required_qty_unit: values.required_qty_unit || undefined,
    density:           values.density           || undefined,
    strength:          values.strength          || undefined,
    ww_ratio:          values.ww_ratio          || undefined,
    molarity:          values.molarity          || undefined,
    remarks:           values.remarks           || undefined,
    ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
  });

  const handleAddInput = async (values: Record<string, string>) => {
    try {
      const inp = await addExperimentInput(id!, buildInputBody(values, inputs.length + 1));
      setInputs(prev => [...prev, inp]);
      addInputForm.resetFields();
      setChemSuggestions([]);
      setAddInputOpen(false);
      message.success('Input added');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleEditInputSubmit = async (values: Record<string, string>) => {
    if (!editingInput) return;
    try {
      const updated = await updateExperimentInput(id!, editingInput.id, buildInputBody(values));
      setInputs(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditInputOpen(false);
      setEditingInput(null);
      setChemSuggestions([]);
      message.success('Input updated');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDeleteInput = async (inputId: string) => {
    try {
      await deleteExperimentInput(id!, inputId);
      setInputs(prev => prev.filter(i => i.id !== inputId));
      message.success('Input removed');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  // â"€â"€ Parameters CRUD â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const buildParamBody = (values: Record<string, string>, sortOrder?: number) => ({
    name:                    values.name                    || values.code || '',
    code:                    values.code                    || undefined,
    input_output:            values.input_output            || 'INPUT',
    user_entered_or_formula: values.user_entered_or_formula || 'USER ENTERED',
    param_type:              values.param_type              || 'NUMBER',
    formula_expression:      values.user_entered_or_formula === 'FORMULA'
                               ? (values.formula_expression || undefined)
                               : undefined,
    parameter_value:         values.user_entered_or_formula !== 'FORMULA'
                               ? (values.parameter_value || undefined)
                               : undefined,
    uom:                     values.uom     || undefined,
    remarks:                 values.remarks || undefined,
    ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
  });

  const handleAddParam = async (values: Record<string, string>) => {
    try {
      const p = await addExperimentParameter(id!, buildParamBody(values, params.length + 1));
      setParams(prev => [...prev, p]);
      addParamForm.resetFields();
      setAddParamOpen(false);
      message.success('Parameter added');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleEditParam = async (values: Record<string, string>) => {
    if (!editingParam) return;
    try {
      const updated = await updateExperimentParameter(id!, editingParam.id, buildParamBody(values));
      setParams(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditParamOpen(false);
      setEditingParam(null);
      message.success('Parameter updated');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDeleteParam = async (paramId: string) => {
    try {
      await deleteExperimentParameter(id!, paramId);
      setParams(prev => prev.filter(p => p.id !== paramId));
      message.success('Parameter removed');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  // â"€â"€ TLC â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const handleAddTLC = async (values: Record<string, string>) => {
    try {
      const tlc = await addExperimentTLC(id!, {
        solvent_system:       values.solvent_system || undefined,
        rf_starting_material: values.rf_sm         || undefined,
        rf_product:           values.rf_product    || undefined,
        visualization:        values.visualization || undefined,
        notes:                values.notes         || undefined,
      });
      setTlcRows(prev => [...prev, tlc]);
      addTLCForm.resetFields();
      setAddTLCOpen(false);
      message.success('TLC entry added');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  // â"€â"€ Attachments â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ Steps CRUD â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const handleAddStep = async (values: Record<string, string>) => {
    try {
      const step = await addExperimentStep(id!, {
        step_no:          steps.length + 1,
        procedure_text:   values.procedure_text   || undefined,
        observation_text: values.observation_text || undefined,
        qty:              values.qty              || undefined,
        temperature:      values.temperature      || undefined,
      });
      setSteps(prev => [...prev, step]);
      addStepForm.resetFields();
      setAddStepOpen(false);
      message.success('Step added');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to add step');
    }
  };

  const handleEditStep = async (values: Record<string, string>) => {
    if (!editingStep) return;
    try {
      const updated = await updateExperimentStep(id!, editingStep.id, {
        procedure_text:   values.procedure_text   || undefined,
        observation_text: values.observation_text || undefined,
        qty:              values.qty              || undefined,
        temperature:      values.temperature      || undefined,
      });
      setSteps(prev => prev.map(s => s.id === updated.id ? updated : s));
      setEditStepOpen(false);
      setEditingStep(null);
      message.success('Step updated');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to update step');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      await deleteExperimentStep(id!, stepId);
      setSteps(prev => {
        const filtered = prev.filter(s => s.id !== stepId);
        // Re-number after delete
        return filtered.map((s, i) => ({ ...s, step_no: i + 1 }));
      });
      message.success('Step removed');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to remove step');
    }
  };

  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx < 0) return;
    if (direction === 'up'   && idx === 0)              return;
    if (direction === 'down' && idx === steps.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSteps = [...steps];
    // Swap step_no values
    const tempNo = newSteps[idx].step_no;
    newSteps[idx]     = { ...newSteps[idx],     step_no: newSteps[swapIdx].step_no };
    newSteps[swapIdx] = { ...newSteps[swapIdx], step_no: tempNo };
    // Swap array positions
    [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
    setSteps(newSteps);

    // Persist both changes
    try {
      await Promise.all([
        updateExperimentStep(id!, newSteps[swapIdx].id, { step_no: newSteps[swapIdx].step_no }),
        updateExperimentStep(id!, newSteps[idx].id,     { step_no: newSteps[idx].step_no }),
      ]);
    } catch {
      // Reload on failure
      loadExp();
    }
  };

  const handleStepAttachmentUpload = (stepId: string, file: File) => {
    const doUpload = async (pw?: string) => {
      setStepAttachLoading(stepId);
      try {
        const updated = await uploadExperimentStepAttachment(id!, stepId, file, pw);
        setSteps(prev => prev.map(s => s.id === updated.id ? updated : s));
        message.success(`${file.name} attached to step`);
      } finally {
        setStepAttachLoading(null);
      }
      // errors propagate when called via e-sign modal
    };

    if (crdSettings?.reauth_attachment_upload) {
      eSignFnRef.current = async (pw: string) => {
        await doUpload(pw);
        setESignOpen(false);
      };
      setESignLabel('Step Attachment Upload');
      setESignOpen(true);
    } else {
      doUpload().catch(err =>
        message.error(err instanceof Error ? err.message : 'Upload failed')
      );
    }
  };

  // â"€â"€ Equipment CRUD â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const handleAddEquipment = async (values: Record<string, string>) => {
    try {
      const eq = await addExperimentEquipment(id!, {
        instrument_code:    values.instrument_code    || undefined,
        instrument_type:    values.instrument_type    || undefined,
        instrument_name:    values.instrument_name    || undefined,
        maintenance_status: values.maintenance_status || undefined,
        calibration_status: values.calibration_status || undefined,
        start_time:         values.start_time         || undefined,
        end_time:           values.end_time           || undefined,
        remarks:            values.remarks            || undefined,
      });
      setEquipment(prev => [...prev, eq]);
      addEquipForm.resetFields();
      setAddEquipOpen(false);
      message.success('Equipment added');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to add equipment');
    }
  };

  const handleDeleteEquipment = async (equipId: string) => {
    try {
      await deleteExperimentEquipment(id!, equipId);
      setEquipment(prev => prev.filter(e => e.id !== equipId));
      message.success('Equipment removed');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  // â"€â"€ Columns â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const editable = exp ? isEditable(exp.status) : false;

  // Core columns always visible
  const inputCoreColumns: ColumnsType<ExperimentInputResponse> = [
    {
      title: 'Material Name', dataIndex: 'material_name', key: 'material_name',
      width: 160, fixed: 'left' as const,
    },
    { title: 'CAS No.',    dataIndex: 'cas_no',        key: 'cas_no',    width: 110, render: (v) => v ?? '---' },
    { title: 'Formula',    dataIndex: 'formula',       key: 'formula',   width: 90,  render: (v) => v ?? '---' },
    { title: 'Mol. Wt.',   dataIndex: 'mol_weight',    key: 'mol_weight',width: 80,  render: (v) => v ?? '---' },
    { title: 'Quantity',   dataIndex: 'quantity',      key: 'quantity',  width: 80,  render: (v) => v ?? '---' },
    { title: 'Unit',       dataIndex: 'unit',          key: 'unit',      width: 70,  render: (v) => v ?? '---' },
    { title: 'Purity %',   dataIndex: 'purity_pct',    key: 'purity_pct',width: 80,  render: (v) => v ?? '---' },
    { title: 'Role',       dataIndex: 'role',          key: 'role',      width: 120, render: (v) => v ?? '---' },
  ];

  // Extra v2 columns shown when "Show more" is toggled
  const inputExtraColumns: ColumnsType<ExperimentInputResponse> = [
    { title: 'Batch/Lot No.',  dataIndex: 'batch_lot_no',     key: 'batch_lot_no',     width: 110, render: (v) => v ?? '---' },
    { title: 'Vendor',         dataIndex: 'vendor_name',      key: 'vendor_name',      width: 120, render: (v) => v ?? '---' },
    { title: 'Batch No.',      dataIndex: 'batch_no',         key: 'batch_no',         width: 100, render: (v) => v ?? '---' },
    { title: 'Avail. Qty',     dataIndex: 'available_qty',    key: 'available_qty',    width: 90,  render: (v) => v ?? '---' },
    { title: 'Req. Qty',       dataIndex: 'required_qty',     key: 'required_qty',     width: 80,  render: (v) => v ?? '---' },
    { title: 'Req. Unit',      dataIndex: 'required_qty_unit',key: 'req_qty_unit',     width: 80,  render: (v) => v ?? '---' },
    { title: 'Density',        dataIndex: 'density',          key: 'density',          width: 80,  render: (v) => v ?? '---' },
    { title: 'Strength',       dataIndex: 'strength',         key: 'strength',         width: 80,  render: (v) => v ?? '---' },
    { title: 'W/W Ratio',      dataIndex: 'ww_ratio',         key: 'ww_ratio',         width: 80,  render: (v) => v ?? '---' },
    { title: 'Molarity',       dataIndex: 'molarity',         key: 'molarity',         width: 80,  render: (v) => v ?? '---' },
    { title: 'Moles',          dataIndex: 'moles',            key: 'moles',            width: 80,  render: (v) => v ?? '---' },
    { title: 'Mole Ratio',     dataIndex: 'mole_ratio',       key: 'mole_ratio',       width: 90,  render: (v) => v ?? '---' },
    { title: 'Remarks',        dataIndex: 'remarks',          key: 'remarks',          width: 140, ellipsis: true, render: (v) => v ?? '---' },
  ];

  const inputActionColumn: ColumnsType<ExperimentInputResponse> = editable ? [{
    title: 'Actions', key: 'actions', width: 88, fixed: 'right' as const,
    render: (_: unknown, record: ExperimentInputResponse) => (
      <div style={{ display: 'flex', gap: 4 }}>
        <Tooltip title="Edit">
          <Button size="small" type="text" icon={<EditOutlined />}
            onClick={() => {
              setEditingInput(record);
              editInputForm.setFieldsValue({ ...record });
              setChemSuggestions([]);
              setEditInputOpen(true);
            }} />
        </Tooltip>
        <Popconfirm title="Remove this input?" onConfirm={() => handleDeleteInput(record.id)}
          okText="Remove" okButtonProps={{ danger: true }}>
          <Button size="small" icon={<DeleteOutlined />} danger type="text" />
        </Popconfirm>
      </div>
    ),
  }] : [];

  const inputColumns: ColumnsType<ExperimentInputResponse> = [
    ...inputCoreColumns,
    ...(showExtraCols ? inputExtraColumns : []),
    ...inputActionColumn,
  ];

  const paramColumns: ColumnsType<ExperimentParameterResponse> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 80,
      render: (v, r) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#0f766e' }}>
          {v || r.name || '---'}
        </span>
      ),
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true,
      render: (v) => v ?? '---',
    },
    {
      title: 'I/O', dataIndex: 'input_output', key: 'input_output', width: 80,
      render: (v) => (
        <Tag color={v === 'OUTPUT' ? 'green' : 'blue'} style={{ fontSize: 11 }}>
          {v || 'INPUT'}
        </Tag>
      ),
    },
    {
      title: 'Type', dataIndex: 'param_type', key: 'param_type', width: 80,
      render: (v) => (
        <Tag style={{ fontSize: 11, borderStyle: 'dashed' }}>{v || 'NUMBER'}</Tag>
      ),
    },
    {
      title: 'Value / Formula', key: 'value_or_formula', width: 180,
      render: (_: unknown, r: ExperimentParameterResponse) => {
        const isFormula = r.user_entered_or_formula === 'FORMULA';
        const isOutput  = r.input_output === 'OUTPUT';
        if (isFormula) {
          return (
            <Tooltip title={r.formula_expression ? `= ${r.formula_expression}` : 'No formula set'}>
              <span style={{ cursor: 'default' }}>
                <Tag color="purple" style={{ fontSize: 11, marginRight: 4 }}>fx</Tag>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: isOutput ? '#047857' : '#0f766e' }}>
                  {r.parameter_value ?? r.value ?? '---'}
                </span>
              </span>
            </Tooltip>
          );
        }
        return (
          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {r.parameter_value ?? r.value ?? '---'}
          </span>
        );
      },
    },
    {
      title: 'UOM', dataIndex: 'uom', key: 'uom', width: 80,
      render: (v, r) => v ?? r.unit ?? '---',
    },
    {
      title: 'Source', dataIndex: 'user_entered_or_formula', key: 'source', width: 110,
      render: (v) => (
        <span style={{ fontSize: 12, color: '#78716c' }}>
          {v === 'FORMULA' ? 'âš™ Formula' : 'âœ User entered'}
        </span>
      ),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', key: 'remarks', ellipsis: true,
      render: (v) => v ?? '---',
    },
    ...(editable ? [{
      title: 'Actions', key: 'actions', width: 88,
      render: (_: unknown, record: ExperimentParameterResponse) => {
        const isOutputFormula =
          record.input_output === 'OUTPUT' &&
          record.user_entered_or_formula === 'FORMULA';
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <Tooltip title={isOutputFormula ? 'Output formula --- read-only' : 'Edit'}>
              <Button size="small" type="text" icon={<EditOutlined />}
                disabled={isOutputFormula}
                onClick={() => {
                  setEditingParam(record);
                  editParamForm.setFieldsValue({
                    code:                    record.code                    ?? '',
                    name:                    record.name                    ?? '',
                    input_output:            record.input_output            || 'INPUT',
                    user_entered_or_formula: record.user_entered_or_formula || 'USER ENTERED',
                    param_type:              record.param_type              || 'NUMBER',
                    formula_expression:      record.formula_expression      ?? '',
                    parameter_value:         record.parameter_value ?? record.value ?? '',
                    uom:                     record.uom ?? record.unit ?? '',
                    remarks:                 record.remarks ?? '',
                  });
                  setEditParamOpen(true);
                }} />
            </Tooltip>
            <Popconfirm title="Remove this parameter?" onConfirm={() => handleDeleteParam(record.id)}
              okText="Remove" okButtonProps={{ danger: true }}>
              <Button size="small" icon={<DeleteOutlined />} danger type="text" />
            </Popconfirm>
          </div>
        );
      },
    }] : []),
  ];

  const tlcColumns: ColumnsType<ExperimentTLCResponse> = [
    { title: 'Solvent System',  dataIndex: 'solvent_system',       key: 'solvent_system',  render: (v) => v ?? '---' },
    { title: 'Rf SM',           dataIndex: 'rf_starting_material', key: 'rf_sm',           render: (v) => v ?? '---' },
    { title: 'Rf Product',      dataIndex: 'rf_product',           key: 'rf_product',      render: (v) => v ?? '---' },
    { title: 'Visualization',   dataIndex: 'visualization',        key: 'visualization',   render: (v) => v ?? '---' },
    { title: 'Notes',           dataIndex: 'notes',                key: 'notes',           render: (v) => v ?? '---' },
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

  // â"€â"€ Loading / not found â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

          {/* â"€â"€ Header card â"€â"€ */}
          <div className={styles.headerCard}>
            <div className={styles.headerTop}>
              <div className={styles.headerLeft}>
                <span className={styles.experimentCode}>{exp.full_code}</span>

                {/* v2: Highlighted badge */}
                {exp.is_highlighted && (
                  <Tooltip title={exp.highlight_comments ?? 'Flagged by QA'}>
                    <Tag icon={<StarFilled />} color="gold" style={{ cursor: 'default' }}>
                      Highlighted
                    </Tag>
                  </Tooltip>
                )}

                <Tag className={`${styles.statusTag} ${STATUS_CLASS[exp.status] ?? styles.statusDraft}`}>
                  {exp.status}
                </Tag>

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

                {/* Revise (REJECTED â†' DRAFT) */}
                {exp.status === 'REJECTED' && (
                  <Popconfirm title="Move back to Draft for revision?" onConfirm={handleRevise} okText="Revise">
                    <Button size="small" icon={<HistoryOutlined />} loading={actionLoading === 'Revise'}>
                      Revise (â†' Draft)
                    </Button>
                  </Popconfirm>
                )}

                {/* Verify / Reject (SUBMITTED or VERIFICATION REQUESTED) */}
                {needsVerify && canVerify && (
                  <>
                    <Button size="small" icon={<CheckCircleOutlined />}
                      style={{ borderColor: '#0d9488', color: '#0d9488' }}
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
                          style={{ width: '100%', background: '#0f766e', borderColor: '#0f766e' }}
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
                    style={{ borderColor: '#0f766e', color: '#0f766e' }}
                  >
                    Export Report
                  </Button>
                </Dropdown>

                {/* Void */}
                {exp.status !== 'VOID' && (
                  <Popconfirm title="Void this experiment? This cannot be undone."
                    onConfirm={handleVoid} okText="Void" okButtonProps={{ danger: true }}>
                    <Button size="small" danger ghost loading={actionLoading === 'Void'}>Void</Button>
                  </Popconfirm>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className={styles.metaRow}>
              <div className={styles.metaItem}>
                Created by: <span>{exp.creator_name ?? exp.created_by}</span>
              </div>
              <div className={styles.metaItem}>
                Date: <span>{exp.created_at?.slice(0, 10)}</span>
              </div>
              {exp.reaction_type && (
                <div className={styles.metaItem}>
                  Reaction: <span>{exp.reaction_type}</span>
                </div>
              )}
              {exp.verified_by && (
                <div className={styles.metaItem}>
                  Verified by: <span>{exp.verified_by_name ?? exp.verified_by}</span>
                </div>
              )}
              {exp.approved_by && (
                <div className={styles.metaItem}>
                  Approved by: <span>{exp.approved_by_name ?? exp.approved_by}</span>
                </div>
              )}
              {/* v2: submitted_to */}
              {exp.submitted_to && (exp.status === 'VERIFICATION REQUESTED' || exp.status === 'SUBMITTED') && (
                <div className={styles.metaItem}>
                  Submitted to: <span>{exp.submitted_to_name ?? '(Verifier assigned)'}</span>
                </div>
              )}
              {/* v2: reference experiment */}
              {exp.reference_exp_code && (
                <div className={styles.metaItem}>
                  <LinkOutlined style={{ marginRight: 4, color: '#0f766e' }} />
                  Reference: <span
                    style={{ color: '#0f766e', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => navigate(`/experiments?search=${exp.reference_exp_code}`)}
                  >
                    {exp.reference_exp_code}
                  </span>
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

            {/* v2: Post-verification remarks (read-only, set by verifier) */}
            {exp.post_verification_remarks && (
              <Alert
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                message="Post-Verification Remarks"
                description={exp.post_verification_remarks}
                style={{ marginTop: 10 }}
              />
            )}

            {/* v2: Improvement suggestions (read-only, set after rejection) */}
            {exp.improvement_suggestions && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message="Improvement Suggestions"
                description={exp.improvement_suggestions}
                style={{ marginTop: 10 }}
              />
            )}
          </div>

          {/* â"€â"€ Tabs card â"€â"€ */}
          <div className={`${styles.tabsCard} ${singlePage ? styles.singlePageTabs : ''}`}>
            <Tabs size="small" tabPosition="top"
              destroyInactiveTabPane={false}
              onChange={key => {
                if (key === 'history') loadHistory();
              }}>

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
                  <div>
                    <div className={styles.fieldLabel}>Aim</div>
                    <RichTextEditor value={draftAim} onChange={setDraftAim}
                      readOnly={!editable} placeholder="Describe the aim..." minHeight={100} />
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Objective</div>
                    <RichTextEditor value={draftObjective} onChange={setDraftObjective}
                      readOnly={!editable} placeholder="Describe the objective..." minHeight={100} />
                  </div>
                  {/* v2: Precautions */}
                  <div>
                    <div className={styles.fieldLabel}>Precautions</div>
                    <RichTextEditor value={draftPrecautions} onChange={setDraftPrecautions}
                      readOnly={!editable} placeholder="List safety precautions..." minHeight={80} />
                  </div>
                  <div className={styles.reactionGrid}>
                    <div>
                      <div className={styles.fieldLabel}>Starting Material</div>
                      {editable
                        ? <Input value={draftStarting} onChange={e => setDraftStarting(e.target.value)} size="small" placeholder="e.g. Salicylic Acid" />
                        : <div className={styles.viewValue}>{draftStarting || '---'}</div>}
                    </div>
                    <div>
                      <div className={styles.fieldLabel}>Target Product</div>
                      {editable
                        ? <Input value={draftTarget} onChange={e => setDraftTarget(e.target.value)} size="small" placeholder="e.g. Aspirin" />
                        : <div className={styles.viewValue}>{draftTarget || '---'}</div>}
                    </div>
                    <div>
                      <div className={styles.fieldLabel}>Reaction Type</div>
                      {editable
                        ? <Input value={draftReaction} onChange={e => setDraftReaction(e.target.value)} size="small" placeholder="e.g. Esterification" />
                        : <div className={styles.viewValue}>{draftReaction || '---'}</div>}
                    </div>
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
                    <div className={styles.fieldLabel}>Procedure</div>
                    <RichTextEditor value={draftProcedure} onChange={setDraftProcedure}
                      readOnly={!editable} placeholder="Describe the procedure step by step..." minHeight={220} />
                  </div>
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
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div className={styles.fieldLabel} style={{ margin: 0 }}>Reaction Scheme</div>
                      {editable && (
                        <span style={{ fontSize: 12, color: '#78716c' }}>
                          Draw the reaction scheme below --- it will be saved when you click <strong>Save</strong>
                        </span>
                      )}
                    </div>
                    <KetcherEditor
                      ref={ketcherRef}
                      initialMol={exp.scheme_mol}
                      readOnly={!editable}
                    />
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
                      readOnly={!editable} placeholder="Write your conclusion---¦" minHeight={160} />
                  </div>
                  <div>
                    <div className={styles.sectionTitle}>Yield Data</div>
                    <div className={styles.statCardsRow}>
                      <div className={styles.statCard}>
                        <div className={styles.statCardLabel}>Theoretical Yield</div>
                        {editable
                          ? <Input value={draftTheoYield} onChange={e => setDraftTheoYield(e.target.value)} size="small" placeholder="g" />
                          : <div className={styles.statCardValue}>{exp.theoretical_yield ?? '---'}</div>
                        }
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statCardLabel}>Actual Yield</div>
                        {editable
                          ? <Input value={draftActYield} onChange={e => setDraftActYield(e.target.value)} size="small" placeholder="g" />
                          : <div className={styles.statCardValue}>{exp.actual_yield ?? '---'}</div>
                        }
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statCardLabel}>% Yield</div>
                        {editable
                          ? <Input value={draftYieldPct} onChange={e => setDraftYieldPct(e.target.value)} size="small" placeholder="%" />
                          : <div className={styles.statCardValue}>{exp.yield_pct ? `${exp.yield_pct}%` : '---'}</div>
                        }
                      </div>
                    </div>
                  </div>
                </div>}
              </TabPane>

              {/* Inputs */}
              <TabPane forceRender tab={`Inputs (${inputs.length})`} key="inputs">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('inputs')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('inputs') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Inputs ({inputs.length})</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('inputs')) && <div className={styles.tabContent}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div className={styles.sectionTitle} style={{ margin: 0 }}>Reactants &amp; Reagents</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Checkbox
                          checked={showExtraCols}
                          onChange={e => setShowExtraCols(e.target.checked)}
                        >
                          <span style={{ fontSize: 12, color: '#57534e' }}>Show all columns</span>
                        </Checkbox>
                        {editable && (
                          <Button className={styles.addBtn} size="small" icon={<PlusOutlined />}
                            onClick={() => {
                              addInputForm.resetFields();
                              setChemSuggestions([]);
                              setAddInputOpen(true);
                            }}>
                            Add Input
                          </Button>
                        )}
                      </div>
                    </div>
                    <Table<ExperimentInputResponse>
                      className={styles.table}
                      columns={inputColumns}
                      dataSource={inputs.map(i => ({ ...i, key: i.id }))}
                      size="small" pagination={false}
                      scroll={{ x: showExtraCols ? 2000 : 900 }}
                      locale={{ emptyText: 'No inputs added yet.' }}
                    />
                  </div>
                </div>}
              </TabPane>

              {/* Parameters */}
              <TabPane forceRender tab={`Parameters (${params.length})`} key="parameters">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('parameters')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('parameters') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Parameters ({params.length})</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('parameters')) && <div className={styles.tabContent}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className={styles.sectionTitle} style={{ margin: 0 }}>Experiment Parameters</div>
                      {editable && (
                        <Button className={styles.addBtn} size="small" icon={<PlusOutlined />}
                          onClick={() => { addParamForm.resetFields(); setAddParamOpen(true); }}>
                          Add Parameter
                        </Button>
                      )}
                    </div>
                    <Table<ExperimentParameterResponse> style={{ marginTop: 8 }}
                      className={styles.table}
                      columns={paramColumns}
                      dataSource={params.map(p => ({ ...p, key: p.id }))}
                      size="small" pagination={false}
                      locale={{ emptyText: 'No parameters added yet.' }}
                    />
                  </div>
                </div>}
              </TabPane>

              {/* TLC */}
              <TabPane forceRender tab="TLC" key="tlc">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('tlc')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('tlc') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>TLC</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('tlc')) && <div className={styles.tabContent}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className={styles.sectionTitle} style={{ margin: 0 }}>TLC Entries</div>
                      {editable && (
                        <Button className={styles.addBtn} size="small" icon={<PlusOutlined />}
                          onClick={() => { addTLCForm.resetFields(); setAddTLCOpen(true); }}>
                          Add TLC Entry
                        </Button>
                      )}
                    </div>
                    <Table<ExperimentTLCResponse> style={{ marginTop: 8 }}
                      className={styles.table}
                      columns={tlcColumns}
                      dataSource={tlcRows.map(t => ({ ...t, key: t.id }))}
                      size="small" pagination={false}
                      locale={{ emptyText: 'No TLC entries yet.' }}
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

              {/* Procedure Steps (v2) */}
              <TabPane forceRender tab={`Steps (${steps.length})`} key="steps">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('steps')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('steps') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Steps ({steps.length})</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('steps')) && <div className={styles.tabContent}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className={styles.sectionTitle} style={{ margin: 0 }}>Procedure Steps</div>
                      {editable && (
                        <Button className={styles.addBtn} size="small" icon={<PlusOutlined />}
                          onClick={() => { addStepForm.resetFields(); setAddStepOpen(true); }}>
                          Add Step
                        </Button>
                      )}
                    </div>
                    <Table<ExperimentStepResponse> style={{ marginTop: 8 }}
                      className={styles.table}
                      rowKey="id"
                      columns={[
                        {
                          title: '#', dataIndex: 'step_no', width: 48,
                          render: (v) => <span style={{ fontWeight: 700, color: '#0f766e' }}>{v}</span>,
                        },
                        {
                          title: 'Procedure', dataIndex: 'procedure_text',
                          render: (v) => v
                            ? <span style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: v }} />
                            : <span style={{ color: '#a8a29e' }}>---</span>,
                        },
                        {
                          title: 'Observation', dataIndex: 'observation_text',
                          render: (v) => v
                            ? <span style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: v }} />
                            : <span style={{ color: '#a8a29e' }}>---</span>,
                        },
                        { title: 'Qty',   dataIndex: 'qty',         width: 80,  render: (v) => v ?? '---' },
                        { title: 'Temp',  dataIndex: 'temperature', width: 80,  render: (v) => v ?? '---' },
                        {
                          title: 'Attachment', dataIndex: 'attachment_name', width: 140,
                          render: (v, record) => {
                            if (v) {
                              return (
                                <Tooltip title={v}>
                                  <span style={{ color: '#0f766e', fontSize: 12 }}>
                                    <PaperClipOutlined style={{ marginRight: 4 }} />
                                    {v.length > 16 ? v.slice(0, 13) + '---¦' : v}
                                  </span>
                                </Tooltip>
                              );
                            }
                            if (!editable) return <span style={{ color: '#a8a29e' }}>---</span>;
                            return (
                              <Upload
                                showUploadList={false}
                                beforeUpload={(file) => {
                                  handleStepAttachmentUpload(record.id, file);
                                  return false;
                                }}
                              >
                                <Button
                                  size="small" type="text"
                                  icon={<UploadOutlined />}
                                  loading={stepAttachLoading === record.id}
                                  style={{ fontSize: 12, color: '#0f766e' }}
                                >
                                  Attach
                                </Button>
                              </Upload>
                            );
                          },
                        },
                        ...(editable ? [{
                          title: 'Actions', key: 'actions', width: 100,
                          render: (_: unknown, record: ExperimentStepResponse) => (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <Tooltip title="Move up">
                                <Button size="small" type="text" icon={<UpOutlined />}
                                  disabled={record.step_no === 1}
                                  onClick={() => handleMoveStep(record.id, 'up')} />
                              </Tooltip>
                              <Tooltip title="Move down">
                                <Button size="small" type="text" icon={<DownOutlined />}
                                  disabled={record.step_no === steps.length}
                                  onClick={() => handleMoveStep(record.id, 'down')} />
                              </Tooltip>
                              <Tooltip title="Edit">
                                <Button size="small" type="text" icon={<EditOutlined />}
                                  onClick={() => {
                                    setEditingStep(record);
                                    editStepForm.setFieldsValue({
                                      procedure_text:   record.procedure_text   ?? '',
                                      observation_text: record.observation_text ?? '',
                                      qty:              record.qty              ?? '',
                                      temperature:      record.temperature      ?? '',
                                    });
                                    setEditStepOpen(true);
                                  }} />
                              </Tooltip>
                              <Popconfirm title="Remove this step?" onConfirm={() => handleDeleteStep(record.id)}
                                okText="Remove" okButtonProps={{ danger: true }}>
                                <Button size="small" type="text" icon={<DeleteOutlined />} danger />
                              </Popconfirm>
                            </div>
                          ),
                        }] : []),
                      ]}
                      dataSource={steps}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: 'No procedure steps added yet.' }}
                    />
                  </div>
                </div>}
              </TabPane>

              {/* Equipment Used (v2) */}
              <TabPane forceRender tab={`Equipment (${equipment.length})`} key="equipment">
                {singlePage && (
                  <div className={styles.pageViewSectionHeader} onClick={() => toggleSection('equipment')}>
                    <DownOutlined style={{ fontSize: 11, transition: 'transform 0.2s', transform: collapsedSections.has('equipment') ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                    <span>Equipment ({equipment.length})</span>
                  </div>
                )}
                {(!singlePage || !collapsedSections.has('equipment')) && <div className={styles.tabContent}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className={styles.sectionTitle} style={{ margin: 0 }}>Equipment Used</div>
                      {editable && (
                        <Button className={styles.addBtn} size="small" icon={<PlusOutlined />}
                          onClick={() => { addEquipForm.resetFields(); setAddEquipOpen(true); }}>
                          Add Equipment
                        </Button>
                      )}
                    </div>
                    <Table<ExperimentEquipmentResponse> style={{ marginTop: 8 }}
                      className={styles.table}
                      rowKey="id"
                      columns={[
                        { title: 'Code',         dataIndex: 'instrument_code', width: 110, render: (v) => v ?? '---' },
                        { title: 'Type',         dataIndex: 'instrument_type', width: 120, render: (v) => v ?? '---' },
                        { title: 'Name',         dataIndex: 'instrument_name', ellipsis: true, render: (v) => v ?? '---' },
                        {
                          title: 'Maint. Status', dataIndex: 'maintenance_status', width: 120,
                          render: (v) => v
                            ? <Tag color={v === 'OK' ? 'green' : v === 'DUE' ? 'orange' : 'red'} style={{ fontSize: 11 }}>{v}</Tag>
                            : <span style={{ color: '#a8a29e' }}>---</span>,
                        },
                        {
                          title: 'Calib. Status', dataIndex: 'calibration_status', width: 120,
                          render: (v) => v
                            ? <Tag color={v === 'OK' ? 'green' : v === 'DUE' ? 'orange' : 'red'} style={{ fontSize: 11 }}>{v}</Tag>
                            : <span style={{ color: '#a8a29e' }}>---</span>,
                        },
                        {
                          title: 'Start Time', dataIndex: 'start_time', width: 110,
                          render: (v) => v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '---',
                        },
                        {
                          title: 'End Time', dataIndex: 'end_time', width: 110,
                          render: (v) => v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '---',
                        },
                        { title: 'Remarks', dataIndex: 'remarks', ellipsis: true, render: (v) => v ?? '---' },
                        ...(editable ? [{
                          title: 'Actions', key: 'actions', width: 72,
                          render: (_: unknown, record: ExperimentEquipmentResponse) => (
                            <Popconfirm title="Remove this equipment?" onConfirm={() => handleDeleteEquipment(record.id)}
                              okText="Remove" okButtonProps={{ danger: true }}>
                              <Button size="small" type="text" icon={<DeleteOutlined />} danger />
                            </Popconfirm>
                          ),
                        }] : []),
                      ]}
                      dataSource={equipment}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: 'No equipment added yet.' }}
                    />
                  </div>
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
                                  {h.action_at?.slice(0, 16).replace('T', ' ')}
                                </span>
                                {h.action_by_name && (
                                  <span style={{ fontSize: 12, color: '#57534e', marginLeft: 8 }}>
                                    by {h.action_by_name}
                                  </span>
                                )}
                                {h.rejection_reason && (
                                  <div style={{ fontSize: 12, color: '#be123c', marginTop: 3 }}>
                                    <strong>Reason:</strong> {h.rejection_reason}
                                  </div>
                                )}
                                {/* v2: improvement suggestions */}
                                {h.improvement_suggestions && (
                                  <div style={{ fontSize: 12, color: '#b45309', marginTop: 3 }}>
                                    <strong>Improvement suggestions:</strong> {h.improvement_suggestions}
                                  </div>
                                )}
                                {/* v2: save comments */}
                                {h.save_comments && (
                                  <div style={{ fontSize: 12, color: '#57534e', marginTop: 3, fontStyle: 'italic' }}>
                                    Save note: {h.save_comments}
                                  </div>
                                )}
                                {h.revision_note && (
                                  <div style={{ fontSize: 12, color: '#0f766e', marginTop: 3 }}>
                                    <strong>Note:</strong> {h.revision_note}
                                  </div>
                                )}
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

      {/* â"€â"€ E-Signature Modal (v2) â"€â"€ */}
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

      {/* â"€â"€ Save Comments Modal (v2) â"€â"€ */}
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
              placeholder="Briefly describe what you changed (e.g. Updated objective and procedure)---¦" />
          </Form.Item>
        </Form>
      </Modal>

      {/* â"€â"€ Reject Modal â"€â"€ */}
      <Modal title="Reject Experiment" open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        okText="Reject" okButtonProps={{ danger: true }}
        confirmLoading={actionLoading === 'Reject'}
        destroyOnClose width={420}>
        <Form form={rejectForm} layout="vertical" onFinish={handleReject}
          requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="reason" label="Rejection Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Explain why this experiment is being rejected---¦" />
          </Form.Item>
        </Form>
      </Modal>

      {/* â"€â"€ Add Input Modal (v2 expanded) â"€â"€ */}
      <Modal title="Add Input" open={addInputOpen}
        onCancel={() => { setAddInputOpen(false); setChemSuggestions([]); }}
        onOk={() => addInputForm.submit()}
        okText="Add" destroyOnClose width={600}
        className={styles.addInputModal}
        style={{ top: 20 }}>
        <Form form={addInputForm} layout="vertical" onFinish={handleAddInput}
          requiredMark={false} style={{ marginTop: 8 }}>
          {/* Material name with chemical auto-lookup */}
          <Form.Item name="material_name" label="Material Name" rules={[{ required: true }]}>
            <AutoComplete
              options={chemSuggestions.map(c => ({
                value: c.chemical_name,
                label: (
                  <span>
                    <strong>{c.chemical_name}</strong>
                    {c.cas_no && <span style={{ color: '#78716c', fontSize: 12, marginLeft: 6 }}>{c.cas_no}</span>}
                  </span>
                ),
              }))}
              onSearch={val => handleChemSearch(val, addInputForm)}
              onSelect={(val) => {
                const match = chemSuggestions.find(c => c.chemical_name === val);
                if (match) applyChemicalFill(match, addInputForm);
              }}
              placeholder="e.g. Salicylic Acid --- type to auto-fill from master chemicals"
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="cas_no"     label="CAS No."><Input placeholder="69-72-7" /></Form.Item>
            <Form.Item name="formula"    label="Formula"><Input placeholder="C7H6O3" /></Form.Item>
            <Form.Item name="mol_weight" label="Mol. Weight"><Input placeholder="g/mol" /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="quantity"  label="Quantity"><Input placeholder="e.g. 10.0" /></Form.Item>
            <Form.Item name="unit"      label="Unit"><Input placeholder="g, mL, mg" /></Form.Item>
            <Form.Item name="purity_pct" label="Purity %"><Input placeholder="e.g. 99.5" /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="moles"      label="Moles"><Input placeholder="e.g. 0.072" /></Form.Item>
            <Form.Item name="mole_ratio" label="Mole Ratio"><Input placeholder="e.g. 1.0" /></Form.Item>
          </div>
          <Form.Item name="role" label="Role">
            <Input placeholder="e.g. Limiting Reagent, Solvent, Catalyst" />
          </Form.Item>
          {/* v2 extra fields */}
          <div style={{ background: '#f5f5f4', borderRadius: 6, padding: '10px 12px', marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Additional Fields (v2)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Form.Item name="vendor_name"  label="Vendor"><Input placeholder="Sigma-Aldrich" /></Form.Item>
              <Form.Item name="batch_lot_no" label="Batch/Lot No."><Input placeholder="e.g. BCBJ1234" /></Form.Item>
              <Form.Item name="batch_no"     label="Batch No."><Input /></Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Form.Item name="available_qty"     label="Available Qty"><Input /></Form.Item>
              <Form.Item name="required_qty"      label="Required Qty"><Input /></Form.Item>
              <Form.Item name="required_qty_unit" label="Req. Qty Unit"><Input placeholder="g, mL" /></Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Form.Item name="density"  label="Density"><Input placeholder="g/mL" /></Form.Item>
              <Form.Item name="strength" label="Strength"><Input /></Form.Item>
              <Form.Item name="ww_ratio" label="W/W Ratio"><Input /></Form.Item>
            </div>
            <Form.Item name="molarity" label="Molarity"><Input placeholder="mol/L" /></Form.Item>
            <Form.Item name="remarks"  label="Remarks"><Input.TextArea rows={2} /></Form.Item>
          </div>
        </Form>
      </Modal>

      {/* â"€â"€ Edit Input Modal (v2) â"€â"€ */}
      <Modal title="Edit Input" open={editInputOpen}
        onCancel={() => { setEditInputOpen(false); setEditingInput(null); setChemSuggestions([]); }}
        onOk={() => editInputForm.submit()}
        okText="Update" destroyOnClose width={600}>
        <Form form={editInputForm} layout="vertical" onFinish={handleEditInputSubmit}
          requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="material_name" label="Material Name" rules={[{ required: true }]}>
            <AutoComplete
              options={chemSuggestions.map(c => ({
                value: c.chemical_name,
                label: <span><strong>{c.chemical_name}</strong>{c.cas_no && <span style={{ color: '#78716c', fontSize: 12, marginLeft: 6 }}>{c.cas_no}</span>}</span>,
              }))}
              onSearch={val => handleChemSearch(val, editInputForm)}
              onSelect={(val) => {
                const match = chemSuggestions.find(c => c.chemical_name === val);
                if (match) applyChemicalFill(match, editInputForm);
              }}
              placeholder="Material name"
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="cas_no"     label="CAS No."><Input /></Form.Item>
            <Form.Item name="formula"    label="Formula"><Input /></Form.Item>
            <Form.Item name="mol_weight" label="Mol. Weight"><Input /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="quantity"   label="Quantity"><Input /></Form.Item>
            <Form.Item name="unit"       label="Unit"><Input /></Form.Item>
            <Form.Item name="purity_pct" label="Purity %"><Input /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="moles"      label="Moles"><Input /></Form.Item>
            <Form.Item name="mole_ratio" label="Mole Ratio"><Input /></Form.Item>
          </div>
          <Form.Item name="role" label="Role"><Input /></Form.Item>
          <div style={{ background: '#f5f5f4', borderRadius: 6, padding: '10px 12px', marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Additional Fields (v2)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Form.Item name="vendor_name"  label="Vendor"><Input /></Form.Item>
              <Form.Item name="batch_lot_no" label="Batch/Lot No."><Input /></Form.Item>
              <Form.Item name="batch_no"     label="Batch No."><Input /></Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Form.Item name="available_qty"     label="Available Qty"><Input /></Form.Item>
              <Form.Item name="required_qty"      label="Required Qty"><Input /></Form.Item>
              <Form.Item name="required_qty_unit" label="Req. Qty Unit"><Input /></Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Form.Item name="density"  label="Density"><Input /></Form.Item>
              <Form.Item name="strength" label="Strength"><Input /></Form.Item>
              <Form.Item name="ww_ratio" label="W/W Ratio"><Input /></Form.Item>
            </div>
            <Form.Item name="molarity" label="Molarity"><Input /></Form.Item>
            <Form.Item name="remarks"  label="Remarks"><Input.TextArea rows={2} /></Form.Item>
          </div>
        </Form>
      </Modal>

      {/* â"€â"€ Add Parameter Modal (v2 formula engine) â"€â"€ */}
      <Modal title="Add Parameter" open={addParamOpen}
        onCancel={() => setAddParamOpen(false)}
        onOk={() => addParamForm.submit()}
        okText="Add" destroyOnClose width={480}
        className={styles.editorModal} style={{ top: 20 }}>
        <Form
          form={addParamForm}
          layout="vertical"
          onFinish={handleAddParam}
          requiredMark={false}
          style={{ marginTop: 8 }}
          initialValues={{ input_output: 'INPUT', user_entered_or_formula: 'USER ENTERED', param_type: 'NUMBER' }}
        >
          <ParameterFormFields form={addParamForm} />
        </Form>
      </Modal>

      {/* â"€â"€ Edit Parameter Modal (v2) â"€â"€ */}
      <Modal title={`Edit Parameter${editingParam?.code ? ` --- ${editingParam.code}` : ''}`}
        open={editParamOpen}
        onCancel={() => { setEditParamOpen(false); setEditingParam(null); }}
        onOk={() => editParamForm.submit()}
        okText="Update" destroyOnClose width={500}>
        <Form
          form={editParamForm}
          layout="vertical"
          onFinish={handleEditParam}
          requiredMark={false}
          style={{ marginTop: 12 }}
        >
          <ParameterFormFields form={editParamForm} />
        </Form>
      </Modal>

      {/* â"€â"€ Add TLC Modal â"€â"€ */}
      <Modal title="Add TLC Entry" open={addTLCOpen}
        onCancel={() => setAddTLCOpen(false)}
        onOk={() => addTLCForm.submit()}
        okText="Add" destroyOnClose width={480}
        className={styles.editorModal} style={{ top: 20 }}>
        <Form form={addTLCForm} layout="vertical" onFinish={handleAddTLC}
          requiredMark={false} style={{ marginTop: 8 }}>
          <Form.Item name="solvent_system" label="Solvent System">
            <Input placeholder="e.g. EtOAc:Hex 1:1" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="rf_sm" label="Rf Starting Material">
              <Input placeholder="0.00 --- 1.00" />
            </Form.Item>
            <Form.Item name="rf_product" label="Rf Product">
              <Input placeholder="0.00 --- 1.00" />
            </Form.Item>
          </div>
          <Form.Item name="visualization" label="Visualization">
            <Input placeholder="e.g. UV 254nm, KMnO4" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* â"€â"€ Request Unlock Modal â"€â"€ */}
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
              placeholder="Explain why this approved experiment needs to be unlocked for editing---¦" />
          </Form.Item>
        </Form>
      </Modal>

      {/* â"€â"€ Add Step Modal (v2) â"€â"€ */}
      <Modal title="Add Procedure Step" open={addStepOpen}
        onCancel={() => setAddStepOpen(false)}
        onOk={() => addStepForm.submit()}
        okText="Add Step" destroyOnClose width={480}
        className={styles.editorModal} style={{ top: 20 }}>
        <Form form={addStepForm} layout="vertical" onFinish={handleAddStep}
          requiredMark={false} style={{ marginTop: 8 }}>
          <Form.Item name="procedure_text" label="Procedure">
            <Input.TextArea rows={3} placeholder="Describe what to do in this step---¦" />
          </Form.Item>
          <Form.Item name="observation_text" label="Observation / Expected Result">
            <Input.TextArea rows={2} placeholder="What should be observed after this step---¦" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="qty" label="Quantity">
              <Input placeholder="e.g. 5 mL, 2.0 g" />
            </Form.Item>
            <Form.Item name="temperature" label="Temperature">
              <Input placeholder="e.g. 80Â°C, RT" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* â"€â"€ Edit Step Modal (v2) â"€â"€ */}
      <Modal title={`Edit Step ${editingStep?.step_no ?? ''}`} open={editStepOpen}
        onCancel={() => { setEditStepOpen(false); setEditingStep(null); }}
        onOk={() => editStepForm.submit()}
        okText="Update" destroyOnClose width={520}>
        <Form form={editStepForm} layout="vertical" onFinish={handleEditStep}
          requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="procedure_text" label="Procedure">
            <Input.TextArea rows={3} placeholder="Describe what to do in this step---¦" />
          </Form.Item>
          <Form.Item name="observation_text" label="Observation / Expected Result">
            <Input.TextArea rows={2} placeholder="What should be observed after this step---¦" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="qty" label="Quantity">
              <Input placeholder="e.g. 5 mL, 2.0 g" />
            </Form.Item>
            <Form.Item name="temperature" label="Temperature">
              <Input placeholder="e.g. 80Â°C, RT" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* â"€â"€ Add Equipment Modal (v2) â"€â"€ */}
      <Modal title="Add Equipment" open={addEquipOpen}
        onCancel={() => setAddEquipOpen(false)}
        onOk={() => addEquipForm.submit()}
        okText="Add" destroyOnClose width={480}
        className={styles.editorModal} style={{ top: 20 }}>
        <Form form={addEquipForm} layout="vertical" onFinish={handleAddEquipment}
          requiredMark={false} style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="instrument_code" label="Instrument Code">
              <Input placeholder="e.g. HPLC-01" />
            </Form.Item>
            <Form.Item name="instrument_type" label="Instrument Type">
              <Input placeholder="e.g. HPLC, Rotavap, Autoclave" />
            </Form.Item>
          </div>
          <Form.Item name="instrument_name" label="Name / Description">
            <Input placeholder="e.g. Agilent 1260 HPLC" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="maintenance_status" label="Maintenance Status">
              <Input placeholder="OK / DUE / OVERDUE" />
            </Form.Item>
            <Form.Item name="calibration_status" label="Calibration Status">
              <Input placeholder="OK / DUE / OVERDUE" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="start_time" label="Start Time">
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item name="end_time" label="End Time">
              <Input type="datetime-local" />
            </Form.Item>
          </div>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExperimentEditorPage;

