# FastAPI → Node.js Migration Mapping

## Component Mapping

| FastAPI Component | Node.js Equivalent |
|------------------|-------------------|
| FastAPI `app` | Express `app` |
| FastAPI Router (`APIRouter`) | Express `Router` |
| Pydantic `BaseModel` (request) | TypeScript interface + Zod schema |
| Pydantic `BaseModel` (response) | TypeScript interface |
| SQLAlchemy `DeclarativeBase` Model | Sequelize `Model` class |
| SQLAlchemy `relationship()` | Sequelize `hasMany`, `belongsTo`, `hasOne`, `belongsToMany` |
| SQLAlchemy `Session` | Sequelize `Transaction` |
| Alembic migration | Sequelize CLI migration (`queryInterface`) |
| FastAPI `Depends()` | Express middleware / service injection |
| FastAPI `HTTPException` | Custom `AppError` class → global error middleware |
| FastAPI startup event | `app.listen()` callback or startup service |
| FastAPI `BackgroundTasks` | Async function called without await (fire-and-forget) |
| FastAPI `FileResponse` | `res.sendFile()` or `res.download()` |
| FastAPI `UploadFile` | `multer` middleware `req.file` / `req.files` |
| Python `bcrypt` | npm `bcrypt` (same hash format — compatible) |
| `python-jose` JWT | npm `jsonwebtoken` |
| Pydantic `Field(alias=...)` | Sequelize `field` option |
| Python `UUID` | `uuid` npm package; stored as `UUID` type in Postgres |
| SQLAlchemy `func.now()` | `Sequelize.literal('NOW()')` or `DataTypes.NOW` |
| SQLAlchemy `Select FOR UPDATE` | `queryInterface.sequelize.query('SELECT ... FOR UPDATE', {transaction})` |
| `flag_modified()` | Not needed — Sequelize tracks changed fields on assignment |
| `httpx` async client | `axios` npm package |
| FastAPI SSE (`StreamingResponse`) | Express `res.write()` with `text/event-stream` |
| Python `asyncio.Queue` (SSE) | Node.js `EventEmitter` (in-process pub/sub) |
| `xhtml2pdf` | `puppeteer` (headless Chrome HTML→PDF) |
| `python-barcode` | `bwip-js` npm package |
| `qrcode` (Python) | `qrcode` npm package |
| `rdkit` | Not available in Node.js — serve mol images via separate microservice or placeholder |
| `openpyxl` | `exceljs` npm package |
| `python-docx` | `docx` npm package |
| Pydantic Settings | `dotenv` + custom config class |
| FastAPI CORS middleware | `cors` npm package |
| uvicorn | Node.js built-in HTTP server |

---

## Detailed Mapping

### 1. Application Initialization

**FastAPI (Python):**
```python
app = FastAPI()
app.add_middleware(CORSMiddleware, ...)
app.include_router(auth_router, prefix="/api/auth")
```

**Express (TypeScript):**
```typescript
const app = express()
app.use(cors(corsOptions))
app.use('/api/auth', authRouter)
```

---

### 2. Route Handler

**FastAPI:**
```python
@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: UUID, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ...
```

**Express:**
```typescript
router.get('/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.findById(req.params.userId)
    res.json(successResponse('User retrieved successfully.', user))
  } catch (err) { next(err) }
})
```

---

### 3. Pydantic Schema → Zod + TypeScript Interface

**FastAPI:**
```python
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    role_id: UUID
    department_id: Optional[UUID] = None
```

**Express (Zod):**
```typescript
const UserCreateSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  roleId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
})
type UserCreate = z.infer<typeof UserCreateSchema>
```

---

### 4. SQLAlchemy Model → Sequelize Model

**SQLAlchemy:**
```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    role_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("roles.id"), nullable=True)
    role: Mapped[Optional["Role"]] = relationship(back_populates="users")
```

**Sequelize:**
```typescript
class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>
  declare username: string
  declare roleId: string | null
  declare role?: NonAttribute<Role>

  static associate(models: Models) {
    User.belongsTo(models.Role, { foreignKey: 'roleId', as: 'role' })
  }
}
User.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  username: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  roleId: { type: DataTypes.UUID, allowNull: true },
}, { sequelize, tableName: 'users' })
```

---

### 5. FastAPI Dependency → Express Middleware

**FastAPI:**
```python
def get_current_user(credentials = Depends(HTTPBearer()), db = Depends(get_db)) -> User:
    ...
```

**Express:**
```typescript
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) throw new AppError('Unauthorized', 401)
  const payload = verifyToken(token)
  const user = await User.findByPk(payload.sub)
  req.user = user
  next()
}
```

---

### 6. FastAPI HTTPException → AppError + Global Error Middleware

**FastAPI:**
```python
raise HTTPException(status_code=404, detail="User not found")
```

**Express:**
```typescript
throw new AppError('User not found.', 404, 'USER_NOT_FOUND')
// caught by:
app.use((err: Error, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, error: { code: err.code } })
  }
  // 500
})
```

---

### 7. Alembic Migration → Sequelize CLI Migration

**Alembic:**
```python
def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', pg.UUID, primary_key=True),
        sa.Column('username', sa.String(100), nullable=False, unique=True),
    )
```

**Sequelize CLI:**
```javascript
'use strict'
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      username: { type: Sequelize.STRING(100), allowNull: false, unique: true },
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('users')
  }
}
```

---

### 8. SQLAlchemy Session Transaction → Sequelize Transaction

**SQLAlchemy:**
```python
with db.begin():
    db.add(new_record)
    db.flush()
    db.add(related_record)
```

**Sequelize:**
```typescript
const t = await sequelize.transaction()
try {
  const record = await Model.create({...}, { transaction: t })
  await Related.create({...}, { transaction: t })
  await t.commit()
} catch (err) {
  await t.rollback()
  throw err
}
```

---

### 9. SELECT FOR UPDATE (Sequential IDs)

**SQLAlchemy:**
```python
counter = db.execute(
    select(IdSequenceCounter).where(...).with_for_update()
).scalar_one()
```

**Sequelize:**
```typescript
const [rows] = await sequelize.query(
  'SELECT * FROM id_sequence_counters WHERE ... FOR UPDATE',
  { transaction, type: QueryTypes.SELECT }
)
```

---

### 10. Pydantic Settings → dotenv Config

**Python:**
```python
class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    model_config = SettingsConfigDict(env_file=".env")
```

**TypeScript:**
```typescript
import dotenv from 'dotenv'
dotenv.config()

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  secretKey: process.env.SECRET_KEY!,
  jwtAlgorithm: process.env.ALGORITHM || 'HS256',
  // ...
}
```

---

### 11. File Upload

**FastAPI:**
```python
@router.post("/files")
async def upload_file(file: UploadFile = File(...), ...):
    content = await file.read()
    path = save_upload(file, subdir)
```

**Express (multer):**
```typescript
const upload = multer({ dest: config.uploadDir, limits: { fileSize: config.maxUploadBytes } })
router.post('/files', authenticate, upload.single('file'), async (req, res) => {
  const file = req.file
  // file.path, file.originalname, file.size
})
```

---

### 12. File Download

**FastAPI:**
```python
return FileResponse(path, filename=original_name, media_type="application/octet-stream")
```

**Express:**
```typescript
res.download(filePath, originalName)
// or:
res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`)
res.sendFile(filePath)
```

---

### 13. Deep-Merge JSON (Experiments)

**FastAPI:**
```python
for key, value in body.data.items():
    merged = {**existing_data.get(key, {}), **value}
    experiment.data[key] = merged
flag_modified(experiment, "data")
```

**TypeScript:**
```typescript
const existing = experiment.data as Record<string, unknown>
for (const [key, value] of Object.entries(body.data)) {
  existing[key] = { ...(existing[key] as object || {}), ...(value as object) }
}
experiment.data = { ...existing }  // trigger Sequelize change detection
await experiment.save({ transaction })
```

---

### 14. SSE Broadcasting

**FastAPI:**
```python
async def broadcast(event_type: str, data: dict):
    loop.call_soon_threadsafe(...)
```

**Express:**
```typescript
import { EventEmitter } from 'events'
export const sseBus = new EventEmitter()

// Subscribe:
res.setHeader('Content-Type', 'text/event-stream')
const handler = (data: string) => res.write(`data: ${data}\n\n`)
sseBus.on('event', handler)
req.on('close', () => sseBus.off('event', handler))

// Publish (from any service):
sseBus.emit('event', JSON.stringify({ type: 'atrs', ... }))
```

---

### 15. RBAC Privilege Check

**FastAPI:**
```python
def require_privilege(key: str):
    def dependency(user = Depends(get_current_user), db = Depends(get_db)):
        if not user_has_privilege(db, user, key):
            raise HTTPException(403, "Forbidden")
    return Depends(dependency)
```

**Express:**
```typescript
export const requirePrivilege = (key: string) => async (req: Request, res: Response, next: NextFunction) => {
  const hasPriv = await userHasPrivilege(req.user!, key)
  if (!hasPriv) return next(new AppError('Forbidden.', 403, 'FORBIDDEN'))
  next()
}
```

---

## Module-by-Module File Mapping

| FastAPI Module | Express Equivalent |
|---------------|-------------------|
| `app/auth/router.py` | `src/routes/auth.routes.ts` |
| `app/auth/utils.py` | `src/utils/auth.utils.ts` |
| `app/shared/privileges.py` | `src/shared/privileges.ts` |
| `app/shared/ard_settings.py` | `src/shared/ardSettings.ts` |
| `app/shared/files.py` | `src/utils/files.ts` |
| `app/modules/users/router.py` | `src/routes/users.routes.ts` |
| `app/modules/users/schemas.py` | `src/validators/users.validator.ts` |
| `app/modules/users/service.py` | `src/services/users.service.ts` |
| `app/modules/departments/router.py` | `src/routes/departments.routes.ts` |
| `app/modules/labs/router.py` | `src/routes/labs.routes.ts` |
| `app/modules/roles/router.py` | `src/routes/roles.routes.ts` |
| `app/modules/admin/router.py` | `src/routes/admin.routes.ts` |
| `app/modules/master_data/router.py` | `src/routes/masterData.routes.ts` |
| `app/modules/projects/router.py` | `src/routes/projects.routes.ts` |
| `app/modules/projects/notebooks/router.py` | `src/routes/notebooks.routes.ts` |
| `app/modules/projects/experiments/router.py` | `src/routes/experiments.routes.ts` |
| `app/modules/cgt/router.py` | `src/routes/cgt.routes.ts` |
| `app/modules/ard/atr_router.py` | `src/routes/ard/atrs.routes.ts` |
| `app/modules/ard/tests_router.py` | `src/routes/ard/tests.routes.ts` |
| `app/modules/ard/experiments_router.py` | `src/routes/ard/experiments.routes.ts` |
| `app/modules/ard/templates_router.py` | `src/routes/ard/templates.routes.ts` |
| `app/modules/ard/master_data.py` | `src/routes/ard/masterData.routes.ts` |
| `app/modules/inventory/__init__.py` | `src/routes/inventory/index.ts` |
| `app/modules/sse/router.py` | `src/routes/sse.routes.ts` |
| `app/models/*.py` | `src/models/*.model.ts` |
| `alembic/versions/*.py` | `src/database/migrations/*.js` |
| `app/dependencies.py` | `src/middleware/auth.middleware.ts` |
| `app/database.py` | `src/database/connection.ts` |
| `app/config.py` | `src/config/index.ts` |
