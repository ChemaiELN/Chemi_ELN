import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(".env")
from app.database import engine, SessionLocal
from app.models import Base
from app.models.department import Department
from app.models.user import Role, User
from app.models.project import Project
from app.models.route import Route, Stage
from app.models.notebook import Notebook, NotebookPermission
from app.models.experiment import Experiment
from app.models.atr import ATR
from app.models.sequence import SequenceCounter
from app.core.security import hash_password
from app.models.base import new_uuid
print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Tables created.")
db = SessionLocal()
ROLES = [("QA","Quality Assurance"),("HOD","Head of Department"),("TL","Team Lead"),("CHEM","Chemist")]
role_map = {}
for code, name in ROLES:
    r = db.query(Role).filter_by(code=code).first()
    if not r:
        r = Role(id=new_uuid(), code=code, name=name)
        db.add(r); db.flush()
    role_map[code] = r.id
db.commit(); print("Roles OK")
DEPTS = [("RD","Research Development"),("ARD","Analytical RD"),("QA","Quality Assurance"),("PROD","Production")]
dept_map = {}
for code, name in DEPTS:
    d = db.query(Department).filter_by(code=code).first()
    if not d:
        d = Department(id=new_uuid(), code=code, name=name)
        db.add(d); db.flush()
    dept_map[code] = d.id
db.commit(); print("Depts OK")
USERS = [
    ("admin","EMP-001","Dr.","Admin","User","Admin User","admin@eln.com","QA","QA"),
    ("john.doe","EMP-002","Dr.","John","Doe","John Doe","john@eln.com","HOD","RD"),
    ("alice.k","EMP-003","Ms.","Alice","Kumar","Alice Kumar","alice@eln.com","TL","RD"),
    ("bob.m","EMP-004","Mr.","Bob","Miller","Bob Miller","bob@eln.com","CHEM","ARD"),
    ("carol.p","EMP-005","Ms.","Carol","Parker","Carol Parker","carol@eln.com","CHEM","RD"),
    ("dave.r","EMP-006","Mr.","Dave","Ross","Dave Ross","dave@eln.com","CHEM","ARD"),
    ("jane.smith","EMP-007","Dr.","Jane","Smith","Jane Smith","jane@eln.com","TL","QA"),
    ("qa.admin","EMP-000","","QA","Admin","QA Admin","qa@chemia.local","QA","QA"),
]
user_map = {}
for uname,empno,title,fn,ln,dn,email,role,dept in USERS:
    u = db.query(User).filter_by(username=uname).first()
    if not u:
        pwd = "Admin@123" if uname == "qa.admin" else "password123"
        u = User(id=new_uuid(),username=uname,emp_no=empno,title=title,first_name=fn,last_name=ln,display_name=dn,email=email,password_hash=hash_password(pwd),role_id=role_map[role],department_id=dept_map.get(dept),designation=role,is_active=True)
        db.add(u); db.flush()
    user_map[uname] = u.id
db.commit(); print("Users OK")
for sk, prefix in [("EXP","E"),("ATR","ATR"),("NB","NB")]:
    if not db.query(SequenceCounter).filter_by(scope_key=sk).first():
        db.add(SequenceCounter(id=new_uuid(), scope_key=sk, prefix=prefix, last_value=0))
db.commit(); print("Sequences OK")
PROJECTS = [
    ("OQ","Omeprazole Quantum","Omeprazole 20mg","Internal","India","john.doe"),
    ("CAR","Cardio Alpha","Atorvastatin 40mg","External","US","alice.k"),
    ("NEU","Neuro Beta","Donepezil 10mg","Internal","Europe","john.doe"),
]
proj_map = {}
for code, name, pname, ptype, market, created_by in PROJECTS:
    p = db.query(Project).filter_by(code=code).first()
    if not p:
        p = Project(id=new_uuid(),code=code,name=name,product_name=pname,project_type=ptype,market=market,status="ACTIVE",created_by=user_map[created_by],department_id=dept_map["RD"])
        db.add(p); db.flush()
    proj_map[code] = p.id
db.commit(); print("Projects OK")
route_map = {}
for pcode, rcode, rname in [("OQ","R1","Route 1"),("OQ","R2","Route 2"),("CAR","R1","Route 1")]:
    r = db.query(Route).filter_by(code=rcode, project_id=proj_map[pcode]).first()
    if not r:
        r = Route(id=new_uuid(),project_id=proj_map[pcode],code=rcode,name=rname,sort_order=1)
        db.add(r); db.flush()
    route_map[(pcode, rcode)] = r.id
stage_map = {}
for pcode, rcode, scode, sname in [("OQ","R1","S1","S1 Core"),("OQ","R1","S2","S2 Sulf"),("OQ","R2","S1","S1 Ring"),("CAR","R1","S1","S1 Statin")]:
    rid = route_map.get((pcode, rcode))
    if rid:
        s = db.query(Stage).filter_by(code=scode,route_id=rid).first()
        if not s:
            s = Stage(id=new_uuid(),route_id=rid,project_id=proj_map[pcode],code=scode,name=sname,sort_order=1)
            db.add(s); db.flush()
        stage_map[(pcode,rcode,scode)] = s.id
db.commit(); print("Routes+Stages OK")
nb_map = {}
NOTEBOOKS = [
    ("OQ-R1-S1-NB001","OQ R1 S1","OQ",("OQ","R1"),("OQ","R1","S1"),"john.doe"),
    ("OQ-R2-S1-NB001","OQ R2 S1","OQ",("OQ","R2"),("OQ","R2","S1"),"alice.k"),
    ("CAR-R1-S1-NB001","Cardio R1","CAR",("CAR","R1"),("CAR","R1","S1"),"bob.m"),
]
for nbcode, title, pcode, rt_key, st_key, created_by in NOTEBOOKS:
    nb = db.query(Notebook).filter_by(code=nbcode).first()
    if not nb:
        nb = Notebook(id=new_uuid(),code=nbcode,title=title,project_id=proj_map[pcode],route_id=route_map.get(rt_key),stage_id=stage_map.get(st_key),created_by=user_map[created_by],status='ACTIVE')
        db.add(nb); db.flush()
        db.add(NotebookPermission(id=new_uuid(),notebook_id=nb.id,user_id=user_map[created_by],can_view=True,can_edit=True,can_submit=True,can_verify=True,can_approve=True,can_clone=True,can_export=True,can_attach=True,can_comment=True,can_request_unlock=True))
    nb_map[nbcode] = nb.id
db.commit(); print("Notebooks OK")
if db.query(Experiment).count() == 0:
    seq = db.query(SequenceCounter).filter_by(scope_key="EXP").first()
    EXPS = [
        ("OQ-R1-S1-NB001","OQ","R1","S1",1,"APPROVED","john.doe","Initial benzimidazole synthesis"),
        ("OQ-R1-S1-NB001","OQ","R1","S1",2,"SUBMITTED","carol.p","Optimised temperature conditions"),
        ("OQ-R2-S1-NB001","OQ","R2","S1",3,"DRAFT","alice.k","Pyridine ring cyclisation"),
        ("CAR-R1-S1-NB001","CAR","R1","S1",4,"VERIFIED","bob.m","Statin core hydroxy reduction"),
        ("OQ-R1-S1-NB001","OQ","R1","S1",5,"DRAFT","dave.r","Solvent screening study"),
    ]
    for nbcode,pcode,rcode,scode,n,status,created_by,title in EXPS:
        nb = db.query(Notebook).filter_by(code=nbcode).first()
        code = pcode+"/"+rcode+"/"+scode+"/E"+str(n).zfill(5)
        full_code = code+"/001"
        e = Experiment(id=new_uuid(),code=code,full_code=full_code,version=1,title=title,notebook_id=nb_map[nbcode],project_id=nb.project_id,route_id=nb.route_id,stage_id=nb.stage_id,aim='Aim: '+title,objective='Obj: '+title,status=status,is_latest_version=True,created_by=user_map[created_by])
        db.add(e); seq.last_value = n
    db.commit(); print("Experiments OK")
else: print('Experiments already exist')
if db.query(ATR).count() == 0:
    seq = db.query(SequenceCounter).filter_by(scope_key="ATR").first()
    ATRS = [
        ("OQ-R1-S1-NB001","OQ",1,"NMR","Confirm benzimidazole ring by NMR","SUBMITTED","john.doe"),
        ("OQ-R1-S1-NB001","OQ",2,"HPLC","Purity analysis by HPLC","COMPLETED","carol.p"),
        ("OQ-R2-S1-NB001","OQ",3,"MS","Molecular weight by LC-MS","NEW","alice.k"),
        ("CAR-R1-S1-NB001","CAR",4,"IR","Functional group FTIR","VERIFIED","bob.m"),
        ("OQ-R1-S1-NB001","OQ",5,"XRD","Crystal structure determination","NEW","dave.r"),
    ]
    for nbcode,pcode,n,test_type,objectives,status,raised_by in ATRS:
        nb = db.query(Notebook).filter_by(code=nbcode).first()
        a = ATR(id=new_uuid(),atr_no="ATR"+str(n).zfill(8),notebook_id=nb_map[nbcode],project_id=nb.project_id,test_type=test_type,objectives=objectives,status=status,raised_by=user_map[raised_by])
        db.add(a); seq.last_value = n
    db.commit(); print("ATRs OK")
else: print('ATRs already exist')
db.close()
print("=== init_db complete ===")
