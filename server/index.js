const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");

const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.JWT_SECRET || "";
if (SECRET.length < 32) throw new Error("Set JWT_SECRET to a random string of at least 32 characters.");
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the Supabase PostgreSQL connection string.");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  max: Number(process.env.PGPOOL_MAX || 5),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
const app = express();
const httpServer = http.createServer(app);
const allowedOrigin = process.env.CORS_ORIGIN || "*";
const io = new Server(httpServer, { cors: { origin: allowedOrigin === "*" ? true : allowedOrigin } });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id BIGSERIAL PRIMARY KEY, username VARCHAR(20) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player',
      banned INTEGER NOT NULL DEFAULT 0, warnings INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit(
      id BIGSERIAL PRIMARY KEY, actor_id BIGINT, action TEXT NOT NULL,
      target_id BIGINT, detail TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS reports(
      id BIGSERIAL PRIMARY KEY, reporter_id BIGINT NOT NULL,
      target_username TEXT NOT NULL, reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS profiles(
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 1,
      coins INTEGER NOT NULL DEFAULT 100
    );
    CREATE TABLE IF NOT EXISTS world_positions(
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      x DOUBLE PRECISION NOT NULL DEFAULT 0, y DOUBLE PRECISION NOT NULL DEFAULT 0,
      z DOUBLE PRECISION NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS world_positions_updated_idx ON world_positions(updated_at);
    CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
  `);
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if (!rows[0].n && process.env.OWNER_USERNAME && process.env.OWNER_PASSWORD) {
    const hash = await bcrypt.hash(process.env.OWNER_PASSWORD, 12);
    const result = await pool.query("INSERT INTO users(username,password_hash,role) VALUES($1,$2,'owner') RETURNING id", [process.env.OWNER_USERNAME, hash]);
    await pool.query("INSERT INTO profiles(user_id,display_name) VALUES($1,$2)", [result.rows[0].id, process.env.OWNER_USERNAME]);
  }
}
const online = new Map();
const httpPresence = new Map();
const positionWrites = new Map();
const roles = ["player","moderator","admin","manager","owner"];
function onlinePlayerCount() {
  const now = Date.now();
  for (const [id, seen] of httpPresence) if (now - seen >= 20000) httpPresence.delete(id);
  return new Set([...online.values(), ...httpPresence.keys()]).size;
}
function tokenFor(user) { return jwt.sign({ id: user.id }, SECRET, { expiresIn: "7d" }); }
async function auth(req,res,next) {
  try {
    const raw=(req.headers.authorization||"").replace(/^Bearer\\s+/i,"");
    const payload=jwt.verify(raw,SECRET);
    const result=await pool.query("SELECT id,username,role,banned FROM users WHERE id=$1",[payload.id]);
    const user=result.rows[0];
    if(!user || user.banned) return res.status(401).json({error:"حساب معتبر نیست"});
    req.user=user; next();
  } catch { return res.status(401).json({error:"ورود دوباره لازم است"}); }
}
function allow(...allowed) {
  return (req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({error:"دسترسی کافی نیست"});
}
async function audit(actor,action,target=null,detail="") {
  await pool.query("INSERT INTO audit(actor_id,action,target_id,detail) VALUES($1,$2,$3,$4)",[actor,action,target,String(detail).slice(0,500)]);
}
app.use(helmet());
app.use(cors({origin:allowedOrigin==="*" ? true : allowedOrigin}));
app.use(express.json({limit:"16kb"}));
app.use("/api/",rateLimit({windowMs:60000,limit:120,standardHeaders:"draft-7",legacyHeaders:false,skip:req=>req.path.startsWith("/world/")}));
app.use("/api/login",rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:"draft-7",legacyHeaders:false}));
app.use((req,res,next)=>{res.setHeader("Cache-Control","no-store");next();});
app.use("/admin",express.static(path.join(__dirname,"public")));
app.get("/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,service:"OpenLife",online:onlinePlayerCount()});}catch{res.status(503).json({ok:false});}});

app.post("/api/register",rateLimit({windowMs:3600000,limit:5,standardHeaders:"draft-7",legacyHeaders:false}),async(req,res)=>{
  const username=String(req.body.username||"").trim(), password=String(req.body.password||"");
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(username)||password.length<10) return res.status(400).json({error:"نام کاربری ۳ تا ۲۰ حرف انگلیسی و رمز حداقل ۱۰ کاراکتر باشد"});
  try {
    const hash=await bcrypt.hash(password,12);
    const result=await pool.query("INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id",[username,hash]);
    await pool.query("INSERT INTO profiles(user_id,display_name) VALUES($1,$2)",[result.rows[0].id,username]);
    const user={id:Number(result.rows[0].id),username,role:"player"};
    res.status(201).json({token:tokenFor(user),user});
  } catch(e) { if(e.code==="23505") return res.status(409).json({error:"این نام کاربری قبلاً گرفته شده است"}); console.error(e); res.status(500).json({error:"خطای سرور"}); }
});
app.post("/api/login",async(req,res)=>{
  try {
    const username=String(req.body.username||"").trim();
    const result=await pool.query("SELECT * FROM users WHERE username=$1",[username]);
    const user=result.rows[0];
    if(!user||user.banned||!(await bcrypt.compare(String(req.body.password||""),user.password_hash))) return res.status(401).json({error:"نام کاربری یا رمز نادرست است"});
    res.json({token:tokenFor(user),user:{id:Number(user.id),username:user.username,role:user.role}});
  } catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.get("/api/world/players",auth,rateLimit({windowMs:60000,limit:40,keyGenerator:req=>String(req.user.id),standardHeaders:"draft-7",legacyHeaders:false}),async(req,res)=>{
  try {
    const result=await pool.query("SELECT u.id,u.username,w.x,w.y,w.z FROM users u JOIN world_positions w ON w.user_id=u.id WHERE u.banned=0 AND u.id<>$1 AND w.updated_at >= NOW()-INTERVAL '20 seconds' LIMIT 100",[req.user.id]);
    res.json({players:result.rows.map(p=>({...p,id:Number(p.id)}))});
  } catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.post("/api/world/position",auth,rateLimit({windowMs:60000,limit:75,keyGenerator:req=>String(req.user.id),standardHeaders:"draft-7",legacyHeaders:false}),async(req,res)=>{
  const now=Date.now(),previous=positionWrites.get(req.user.id)||0;
  if(now-previous<750)return res.status(429).json({error:"ارسال حرکت خیلی سریع است"});
  const {x,y,z}=req.body||{};
  if(![x,y,z].every(v=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=100000))return res.status(400).json({error:"مختصات نامعتبر است"});
  try {
    await pool.query("INSERT INTO world_positions(user_id,x,y,z,updated_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(user_id) DO UPDATE SET x=EXCLUDED.x,y=EXCLUDED.y,z=EXCLUDED.z,updated_at=NOW()",[req.user.id,x,y,z]);
    positionWrites.set(req.user.id,now);httpPresence.set(req.user.id,now);res.json({ok:true});
  } catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.get("/api/me",auth,async(req,res)=>{
  try {const p=await pool.query("SELECT display_name,level,coins FROM profiles WHERE user_id=$1",[req.user.id]);res.json({user:req.user,profile:p.rows[0]||null});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.get("/api/admin/overview",auth,allow("owner","manager","admin","moderator"),async(req,res)=>{
  try {
    const [a,b,c]=await Promise.all([pool.query("SELECT COUNT(*)::int n FROM users"),pool.query("SELECT COUNT(*)::int n FROM users WHERE banned=1"),pool.query("SELECT COUNT(*)::int n FROM reports WHERE status='open'")]);
    res.json({total:a.rows[0].n,online:onlinePlayerCount(),banned:b.rows[0].n,openReports:c.rows[0].n});
  }catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.get("/api/admin/players",auth,allow("owner","manager","admin","moderator"),async(req,res)=>{
  try {
    const q=String(req.query.q||"").slice(0,40), result=await pool.query("SELECT id,username,role,banned,warnings,created_at FROM users WHERE username ILIKE $1 ORDER BY id DESC LIMIT 100",["%"+q+"%"]);
    res.json({players:result.rows.map(p=>({...p,id:Number(p.id),online:online.has([...online.entries()].find(([,id])=>Number(id)===Number(p.id))?.[0])||(httpPresence.has(Number(p.id))&&Date.now()-httpPresence.get(Number(p.id))<20000)}))});
  }catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.post("/api/admin/player/:id/warn",auth,allow("owner","manager","admin"),async(req,res)=>{
  try {const id=Number(req.params.id),t=await pool.query("SELECT id,role FROM users WHERE id=$1",[id]);if(!t.rows[0]||t.rows[0].role==="owner")return res.status(404).json({error:"بازیکن پیدا نشد"});await pool.query("UPDATE users SET warnings=warnings+1 WHERE id=$1",[id]);await audit(req.user.id,"warn",id,req.body.reason||"");res.json({ok:true});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.post("/api/admin/player/:id/ban",auth,allow("owner","manager","admin"),async(req,res)=>{
  try {const id=Number(req.params.id),t=await pool.query("SELECT id,role FROM users WHERE id=$1",[id]);if(!t.rows[0]||t.rows[0].role==="owner"||(req.user.role!=="owner"&&["manager","admin"].includes(t.rows[0].role)))return res.status(403).json({error:"امکان مسدودسازی این حساب وجود ندارد"});await pool.query("UPDATE users SET banned=1 WHERE id=$1",[id]);await audit(req.user.id,"ban",id,req.body.reason||"");for(const [sid,uid]of online)if(Number(uid)===id){const s=io.sockets.sockets.get(sid);if(s){s.emit("account:banned");s.disconnect(true);}}res.json({ok:true});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.post("/api/admin/player/:id/unban",auth,allow("owner","manager","admin"),async(req,res)=>{
  try {const id=Number(req.params.id);await pool.query("UPDATE users SET banned=0 WHERE id=$1",[id]);await audit(req.user.id,"unban",id,"");res.json({ok:true});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.post("/api/owner/role",auth,allow("owner"),async(req,res)=>{
  try {const id=Number(req.body.userId),role=String(req.body.role||"");if(!roles.includes(role)||role==="owner")return res.status(400).json({error:"نقش نامعتبر است"});const t=await pool.query("SELECT id,role FROM users WHERE id=$1",[id]);if(!t.rows[0]||t.rows[0].role==="owner")return res.status(404).json({error:"کاربر پیدا نشد"});await pool.query("UPDATE users SET role=$1 WHERE id=$2",[role,id]);await audit(req.user.id,"set_role",id,role);res.json({ok:true});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.get("/api/admin/audit",auth,allow("owner","manager"),async(req,res)=>{
  try {const r=await pool.query("SELECT a.*,u.username actor FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100");res.json({events:r.rows});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.post("/api/reports",auth,rateLimit({windowMs:600000,limit:5,keyGenerator:req=>String(req.user.id),standardHeaders:"draft-7",legacyHeaders:false}),async(req,res)=>{
  const target=String(req.body.target||"").trim().slice(0,40),reason=String(req.body.reason||"").trim().slice(0,500);
  if(!target||reason.length<5)return res.status(400).json({error:"اطلاعات گزارش کامل نیست"});
  try {const r=await pool.query("INSERT INTO reports(reporter_id,target_username,reason) VALUES($1,$2,$3) RETURNING id",[req.user.id,target,reason]);res.status(201).json({id:Number(r.rows[0].id)});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.get("/api/admin/reports",auth,allow("owner","manager","admin","moderator"),async(req,res)=>{
  try {const r=await pool.query("SELECT r.*,u.username reporter FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY r.id DESC LIMIT 100");res.json({reports:r.rows});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
app.post("/api/admin/report/:id/resolve",auth,allow("owner","manager","admin","moderator"),async(req,res)=>{
  try {const id=Number(req.params.id),r=await pool.query("UPDATE reports SET status='resolved' WHERE id=$1 RETURNING id",[id]);if(!r.rowCount)return res.status(404).json({error:"گزارش پیدا نشد"});await audit(req.user.id,"resolve_report",id,"");res.json({ok:true});}
  catch(e){console.error(e);res.status(500).json({error:"خطای سرور"});}
});
io.use(async(socket,next)=>{
  try {const payload=jwt.verify(socket.handshake.auth?.token||"",SECRET),r=await pool.query("SELECT id,username,banned FROM users WHERE id=$1",[payload.id]);const user=r.rows[0];if(!user||user.banned)return next(new Error("unauthorized"));socket.user={...user,id:Number(user.id)};next();}
  catch{next(new Error("unauthorized"));}
});
io.on("connection",socket=>{
  online.set(socket.id,socket.user.id);socket.emit("presence:update",{online:onlinePlayerCount()});socket.broadcast.emit("presence:update",{online:onlinePlayerCount()});socket.join("world");
  let lastMoveAt=0;
  socket.on("player:move",async data=>{
    const now=Date.now();if(now-lastMoveAt<100||!data||![data.x,data.y,data.z].every(v=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=100000))return;lastMoveAt=now;
    try {await pool.query("INSERT INTO world_positions(user_id,x,y,z,updated_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(user_id) DO UPDATE SET x=EXCLUDED.x,y=EXCLUDED.y,z=EXCLUDED.z,updated_at=NOW()",[socket.user.id,data.x,data.y,data.z]);httpPresence.set(socket.user.id,now);socket.to("world").emit("player:moved",{id:socket.user.id,x:data.x,y:data.y,z:data.z});}
    catch(e){console.error("socket move failed",e);}
  });
  socket.on("disconnect",()=>{online.delete(socket.id);io.emit("presence:update",{online:onlinePlayerCount()});});
});
async function start(){
  await initDb();
  httpServer.listen(PORT,()=>console.log("OpenLife PostgreSQL server listening on "+PORT));
}
start().catch(error=>{console.error("Database startup failed:",error);process.exit(1);});
process.on("SIGTERM",async()=>{httpServer.close();await pool.end();});
process.on("SIGINT",async()=>{httpServer.close();await pool.end();});
