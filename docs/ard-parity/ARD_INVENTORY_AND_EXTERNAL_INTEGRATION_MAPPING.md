# ARD Inventory & External Integration Mapping

> **Status:** IN PROGRESS — Phase 1 discovery running  
> **Last updated:** 2026-08-01

---

## 1. Empower (Waters LIMS) Integration

### Legacy Evidence
- Controller: `AdEmpowerController` at `/ARD/adEmpowerController/`
- Endpoints:
  - `GET loadEmpowerMetaData` — load connection metadata
  - `POST updateEmpowerMetaData` — update connection settings
  - `POST empowerProjectData/create` — create project in Empower
  - `GET empowerProjectData/get` — get single project data
  - `GET empowerProjectData/getAll` — list all Empower projects
  - `PUT empowerProjectData/update` — update Empower project
  - `GET empowerServerConnections` — list available servers
- Chromatogram: `AtrTestController.convertChromatogram()` at `/ARD/atrTest/convertChromatogram`
  - Takes raw chromatogram data from Empower, converts to displayable format
  - Embedded in `chromatography-section` Angular component

### ELN3 Status
- **NOT IMPLEMENTED** — no Empower integration exists in ELN3
- Parity status: `BLOCKED`
- Reason: Requires Waters Empower LIMS server, API credentials, and customer-specific configuration

### Impact
- Chromatography section in test execution cannot display live chromatogram data
- Test results linked to Empower runs cannot be populated automatically
- Any ATR tests requiring chromatogram results will be affected

### Required Product Decision
> **DECISION REQUIRED:** Is Empower integration in scope for ELN3? If yes, what are the server endpoints and credentials? If no, how will chromatogram data entry be handled (manual upload)?

---

## 2. Stability Module Integration

### Legacy Evidence
- Controller: `StabilityController` in `ard-service-java`
- Calls external `/Stability/` service
- Integration used for stability testing samples linked to ATR forms

### ELN3 Status
- **NOT IMPLEMENTED**
- Parity status: `BLOCKED`

### Required Product Decision
> **DECISION REQUIRED:** Is the Stability module integration in scope for ELN3?

---

## 3. Laurus-ELN Inventory Integration

> The ARD module should pull data from the ELN3 inventory module for:

### 3.1 Materials / Chemicals

| ARD Usage | Inventory Entity | Fields Required | ELN3 Endpoint | Status |
|-----------|-----------------|----------------|---------------|--------|
| ATR samples — material | Material/Chemical | Code, Name, Batch/Lot, Expiry, UOM, Manufacturer, Status | TBD | TBD |
| Experiment materials section | Material/Chemical | Same as above | TBD | TBD |
| QC-TRF sampling — material | Material/Chemical | Same as above | TBD | TBD |

### 3.2 Equipment / Instruments

| ARD Usage | Inventory Entity | Fields Required | ELN3 Endpoint | Status |
|-----------|-----------------|----------------|---------------|--------|
| Experiment equipment tracking | Equipment/Instrument | Code, Name, Calibration date, Maintenance status | TBD | TBD |
| Weighing instruments (balances) | Balance/Weighing instrument | Code, Calibration status, Capacity, Resolution | TBD | TBD |
| pH meters | pH Meter | Code, Calibration status, Buffer ranges | TBD | TBD |
| HPLC / Chromatography columns | Column | Code, Name, Dimension, Stationary phase, Lot, Used runs | TBD | TBD |

### 3.3 Reference Standards

| ARD Usage | Inventory Entity | Fields Required | ELN3 Endpoint | Status |
|-----------|-----------------|----------------|---------------|--------|
| Test execution standards | Reference Standard | Code, Name, Potency/Purity, Expiry, Manufacturer, Certificate | TBD | TBD |

### 3.4 Calibration/Maintenance Safety Interlocks

**Business rule:** An instrument with expired calibration or active maintenance block must NOT be selectable in any ARD workflow step. The server must enforce this — UI hiding alone is insufficient.

| Check | Server enforcement | Client behavior | ELN3 status |
|-------|-------------------|----------------|-------------|
| Instrument calibration valid | Yes — server checks calibration date | Filter from selector | TBD |
| Instrument not in maintenance | Yes — server checks maintenance status | Filter from selector | TBD |
| Material batch not expired | Yes — server checks expiry date | Warning or block | TBD |
| Reference standard not expired | Yes — server checks expiry | Warning or block | TBD |

### 3.5 UOM (Unit of Measure)

- `AdNotebookController.getUOM()` — fetches UOM list for experiment result parameters
- ELN3 must provide equivalent from inventory UOM catalog

---

## 4. PDF/Report Generation

| Report | Legacy Generator | ELN3 Status |
|--------|----------------|-------------|
| Experiment PDF | iText (`adexperimentreport/pdfclasses/`) | TBD |
| ATR COA (Certificate of Analysis) | Java PDF generator | TBD |
| ATR details report | Java PDF generator | TBD |
| ATR labels | Java label generator | TBD |
| QC-TRF summary/PDF | Java PDF generator | TBD |
| Test merged PDF | `AtrTestController.mergePDF()` | TBD |
| Project report | `ReportingController.generateProjectReport()` | TBD |

---

## 5. Notifications / Email

### Legacy
- `EventUtil`, `MailAlert`, `MailThreadClass`, `MailUtil` in `analytical/mail/`
- Observer pattern for async notifications
- Sent on: ATR state transitions, test assignment, experiment reviews, clarification requests

### ELN3 Status
- Notification module exists: `ard_notifications` router registered
- Email implementation: TBD
- Real-time notifications (SSE): KNOWN MISSING from prior analysis

---

*This document will be updated after Phase 1 agent discovery and Phase 6 integration verification.*
