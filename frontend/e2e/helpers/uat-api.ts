import { API_BASE } from './api-auth'

export class ArdApiClient {
  constructor(private token: string) {}

  get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`${method} ${path} failed (${res.status}): ${text}`)
    }
    return res.json() as Promise<T>
  }

  get<T>(path: string): Promise<T> { return this.call<T>('GET', path) }
  post<T>(path: string, body: unknown): Promise<T> { return this.call<T>('POST', path, body) }
  put<T>(path: string, body: unknown): Promise<T> { return this.call<T>('PUT', path, body) }
  patch<T>(path: string, body: unknown): Promise<T> { return this.call<T>('PATCH', path, body) }
  del<T>(path: string): Promise<T> { return this.call<T>('DELETE', path) }

  // ── Auth ─────────────────────────────────────────────────────────────────
  verifyPassword(password = 'Password@123') {
    return this.post<{ verified: boolean; username: string }>('/auth/verify-password', { password })
  }

  // ── Master-data ───────────────────────────────────────────────────────────
  createTechnique(stamp: string) {
    return this.post<any>('/ard/master-data/techniques', {
      code: `TECH-${stamp}`,
      name: `Technique ${stamp}`,
    })
  }

  createTestConfig(techniqueId: string, stamp: string, params?: any[]) {
    return this.post<any>('/ard/master-data/test-configs', {
      techniqueId,
      testType: `Assay ${stamp}`,
      resultParams: params ?? [
        {
          id: 'assay',
          name: 'Assay %',
          dataType: 'number',
          uom: '%',
          validationType: 'RANGE',
          lowerLimit: 95,
          upperLimit: 105,
        },
      ],
    })
  }

  // ── ATR ───────────────────────────────────────────────────────────────────
  async createAtr(stamp: string, extra: Record<string, unknown> = {}) {
    const r = await this.post<any>('/ard/atrs', {
      projectCode: `E2E-ATR-${stamp}`,
      productName: `Product ${stamp}`,
      ...extra,
    })
    // Backend returns formNo; alias as code for convenience
    r.code = r.code ?? r.formNo ?? r.form_no
    return r
  }

  addAtrSample(atrId: string, stamp: string) {
    return this.put<any>(`/ard/atrs/${atrId}`, {
      samples: [
        {
          sampleCode: `S-${stamp}`,
          sampleType: 'API',
          quantity: '10',
          uom: 'g',
          batchNo: `B-${stamp}`,
        },
      ],
    })
  }

  addTestToSample(atrId: string, sampleId: string, configIds: string[]) {
    return this.post<any>(`/ard/atrs/${atrId}/samples/${sampleId}/tests`, {
      testConfigIds: configIds,
    })
  }

  transitionAtr(id: string, to: string, password = 'Password@123') {
    return this.post<any>(`/ard/atrs/${id}/transition`, { to, password })
  }

  // ── Tests ─────────────────────────────────────────────────────────────────
  startTest(atrId: string, testId: string) {
    return this.post<any>(`/ard/tests/${atrId}/${testId}/start`, {})
  }

  saveTestResults(atrId: string, testId: string, value = 99.2, remarks = 'E2E') {
    return this.post<any>(`/ard/tests/${atrId}/${testId}/save-results`, {
      results: [{ parameterId: 'assay', value }],
      resultRemarks: remarks,
    })
  }

  submitTest(atrId: string, testId: string) {
    return this.post<any>(`/ard/tests/${atrId}/${testId}/submit`, { submitRemarks: 'E2E submit' })
  }

  verifyTest(atrId: string, testId: string) {
    return this.post<any>(`/ard/tests/${atrId}/${testId}/verify`, {
      password: 'Password@123',
      verifyRemarks: 'E2E verify',
    })
  }

  // ── Templates ─────────────────────────────────────────────────────────────
  createTemplate(stamp: string, sections?: any[]) {
    return this.post<any>('/ard/templates', {
      code: `TPL-${stamp}`,
      name: `Template ${stamp}`,
      testType: 'HPLC',
      version: '1.0',
      sections: sections ?? [
        {
          id: 'sec1',
          title: 'Reagents & Standards',
          type: 'table',
          columns: [
            { id: 'col1', label: 'Name',         dataType: 'text'   },
            { id: 'col2', label: 'Concentration', dataType: 'number' },
            { id: 'col3', label: 'Batch',         dataType: 'text'   },
          ],
        },
        {
          id: 'sec2',
          title: 'Observations',
          type: 'text',
        },
      ],
    })
  }

  async publishTemplate(id: string) {
    // Template state machine: DRAFT → PENDING_APPROVAL → PUBLISHED
    await this.post<any>(`/ard/templates/${id}/transition`, { to: 'PENDING_APPROVAL' })
    return this.post<any>(`/ard/templates/${id}/transition`, { to: 'PUBLISHED', password: 'Password@123' })
  }

  // ── Experiments ───────────────────────────────────────────────────────────
  createExperiment(templateId: string, stamp: string, notebookId?: string) {
    return this.post<any>('/ard/experiments', {
      templateId,
      code: `EXP-${stamp}`,
      name: `Experiment ${stamp}`,
      ...(notebookId ? { notebookId } : {}),
    })
  }

  patchExperiment(id: string, body: Record<string, unknown>) {
    return this.patch<any>(`/ard/experiments/${id}`, body)
  }

  // ── Notebooks ─────────────────────────────────────────────────────────────
  createNotebook(stamp: string, projectId?: string) {
    return this.post<any>('/ard/notebooks', {
      code: `NB-${stamp}`,
      name: `Notebook ${stamp}`,
      title: `Notebook ${stamp}`,
      ...(projectId ? { projectId } : {}),
    })
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  createProject(stamp: string, extra: Record<string, unknown> = {}) {
    return this.post<any>('/ard/projects', {
      code: `PRJ-${stamp}`,
      productName: `Product ${stamp}`,
      name: `Project ${stamp}`,
      ...extra,
    })
  }

  // ── QC-TRF ────────────────────────────────────────────────────────────────
  createQcTrf(stamp: string, projectCode?: string) {
    return this.post<any>('/ard/qc-trf', {
      projectCode: projectCode ?? `E2E-QC-${stamp}`,
      productName: `QC Product ${stamp}`,
    })
  }
}
