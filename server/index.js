const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");

const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.JWT_SECRET || "";
if (SECRET.length < 32) throw new Error("Set JWT_SECRET to a random string of at least 32 characters.");
const app = express();
const httpServer = http.createServer(app);
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:8080";
const io = new Server(httpServer, { cors: { origin: allowedOrigin } });
const db = new Database(process.env.DB_FILE || "openlife.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'player',
 banned INTEGER NOT NULL DEFAULT 0,
 warnings INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_id INTEGER,
 action TEXT NOT NULL,
 target_id INTEGER,
 detail TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reporter_id INTEGER NOT NULL,
 target_username TEXT NOT NULL,
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS profiles(
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 display_name TEXT NOT NULL DEFAULT '',
 level INTEGER NOT NULL DEFAULT 1,
 coins INTEGER NOT NULL DEFAULT 100
);
CREATE TABLE IF NOT EXISTS world_positions(
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 x REAL NOT NULL DEFAULT 0,
 y REAL NOT NULL DEFAULT 0,
 z REAL NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
const count = db.prepare("SELECT COUNT(*) n FROM users").get().n;
if (!count && process.env.OWNER_USERNAME && process.env.OWNER_PASSWORD) {
 const hash = bcrypt.hashSync(process.env.OWNER_PASSWORD, 12);
 const result = db.prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?, 'owner')").run(process.env.OWNER_USERNAME, hash);
 db.prepare("INSERT INTO profiles(user_id,display_name) VALUES(?,?)").run(result.lastInsertRowid, process.env.OWNER_USERNAME);
}
app.use(helmet());
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "16kb" }));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false, skip: req => req.path.startsWith("/world/") }));
app.use("/api/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }));
app.use((req,res,next)=>{ res.setHeader("Cache-Control","no-store"); next(); });

const online = new Map();
const roles = ["player","moderator","admin","manager","owner"];
function tokenFor(user){ return jwt.sign({ id:user.id }, SECRET, { expiresIn:"7d" }); }
function auth(req,res,next){
 const raw=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 try {
  const payload=jwt.verify(raw,SECRET);
  const user=db.prepare("SELECT id,username,role,banned FROM users WHERE id=?").get(payload.id);
  if(!user || user.banned) return res.status(401).json({error:"حساب معتبر نیست"});
  req.user=user; next();
 } catch { return res.status(401).json({error:"ورود دوباره لازم است"}); }
}
function allow(...allowed){
 return (req,res,next)=> allowed.includes(req.user.role) ? next() : res.status(403).json({error:"دسترسی کافی نیست"});
}
function audit(actor,action,target=null,detail=""){
 db.prepare("INSERT INTO audit(actor_id,action,target_id,detail) VALUES(?,?,?,?)").run(actor,action,target,String(detail).slice(0,500));
}
app.get("/health",(req,res)=>res.json({ok:true,service:"OpenLife",online:onlinePlayerCount()}));
app.post("/api/register",(req,res)=>{
 const username=String(req.body.username||"").trim();
 const password=String(req.body.password||"");
 if(!/^[a-zA-Z0-9_]{3,20}$/.test(username) || password.length<10) return res.status(400).json({error:"نام کاربری ۳ تا ۲۰ حرف انگلیسی و رمز حداقل ۱۰ کاراکتر باشد"});
 try {
  const hash=bcrypt.hashSync(password,12);
  const result=db.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").run(username,hash);
  db.prepare("INSERT INTO profiles(user_id,display_name) VALUES(?,?)").run(result.lastInsertRowid,username);
  const user={id:Number(result.lastInsertRowid),username,role:"player"};
  res.status(201).json({token:tokenFor(user),user});
 } catch { res.status(409).json({error:"این نام کاربری قبلاً گرفته شده است"}); }
});
app.post("/api/login",(req,res)=>{
 const username=String(req.body.username||"").trim();
 const user=db.prepare("SELECT * FROM users WHERE username=?").get(username);
 if(!user || user.banned || !bcrypt.compareSync(String(req.body.password||""),user.password_hash)) return res.status(401).json({error:"نام کاربری یا رمز نادرست است"});
 res.json({token:tokenFor(user),user:{id:user.id,username:user.username,role:user.role}});
});
const positionWrites = new Map();
const httpPresence = new Map();
function onlinePlayerCount(){
 const now=Date.now();
 for (const [id,seenAt] of httpPresence) if (now-seenAt>=20000) httpPresence.delete(id);
 const ids=new Set([...online.values(), ...httpPresence.keys()]);
 return ids.size;
}
app.get("/api/world/players",auth,rateLimit({ windowMs: 60 * 1000, limit: 40, keyGenerator: req => String(req.user.id), standardHeaders: "draft-7", legacyHeaders: false }),(req,res)=>{
 const players=db.prepare("SELECT users.id,users.username,world_positions.x,world_positions.y,world_positions.z FROM users JOIN world_positions ON world_positions.user_id=users.id WHERE users.banned=0 AND users.id<>? AND world_positions.updated_at >= datetime('now','-20 seconds') LIMIT 100").all(req.user.id);
 res.json({players});
});
app.post("/api/world/position",auth,rateLimit({ windowMs: 60 * 1000, limit: 75, keyGenerator: req => String(req.user.id), standardHeaders: "draft-7", legacyHeaders: false }),(req,res)=>{
 const now=Date.now(), previous=positionWrites.get(req.user.id)||0;
 if(now-previous<750) return res.status(429).json({error:"ارسال حرکت خیلی سریع است"});
 const {x,y,z}=req.body||{};
 if(![x,y,z].every(v=>typeof v==="number" && Number.isFinite(v) && Math.abs(v)<=100000))
  return res.status(400).json({error:"مختصات نامعتبر است"});
 positionWrites.set(req.user.id,now);
 httpPresence.set(req.user.id,now);
 db.prepare("INSERT INTO world_positions(user_id,x,y,z,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET x=excluded.x,y=excluded.y,z=excluded.z,updated_at=CURRENT_TIMESTAMP").run(req.user.id,x,y,z);
 res.json({ok:true});
});
app.get("/api/me",auth,(req,res)=>{
 const profile=db.prepare("SELECT display_name,level,coins FROM profiles WHERE user_id=?").get(req.user.id);
 res.json({user:req.user,profile});
});
app.get("/api/admin/overview",auth,allow("owner","manager","admin","moderator"),(req,res)=>{
 const total=db.prepare("SELECT COUNT(*) n FROM users").get().n;
 const banned=db.prepare("SELECT COUNT(*) n FROM users WHERE banned=1").get().n;
 const reports=db.prepare("SELECT COUNT(*) n FROM reports WHERE status='open'").get().n;
 res.json({total,online:onlinePlayerCount(),banned,openReports:reports});
});
app.get("/api/admin/players",auth,allow("owner","manager","admin","moderator"),(req,res)=>{
 const q=String(req.query.q||"").slice(0,40);
 const players=db.prepare("SELECT id,username,role,banned,warnings,created_at FROM users WHERE username LIKE ? ORDER BY id DESC LIMIT 100").all("%"+q+"%");
 res.json({players:players.map(p=>({...p,online:[...online.values()].includes(p.id) || (httpPresence.has(p.id) && Date.now()-httpPresence.get(p.id)<20000)}))});
});
app.post("/api/admin/player/:id/warn",auth,allow("owner","manager","admin"),(req,res)=>{
 const id=Number(req.params.id);
 const target=db.prepare("SELECT id,role FROM users WHERE id=?").get(id);
 if(!target || target.role==="owner") return res.status(404).json({error:"بازیکن پیدا نشد"});
 db.prepare("UPDATE users SET warnings=warnings+1 WHERE id=?").run(id);
 audit(req.user.id,"warn",id,req.body.reason||"");
 res.json({ok:true});
});
app.post("/api/admin/player/:id/ban",auth,allow("owner","manager","admin"),(req,res)=>{
 const id=Number(req.params.id);
 const target=db.prepare("SELECT id,role FROM users WHERE id=?").get(id);
 if(!target || target.role==="owner" || (req.user.role!=="owner" && ["manager","admin"].includes(target.role))) return res.status(403).json({error:"امکان مسدودسازی این حساب وجود ندارد"});
 db.prepare("UPDATE users SET banned=1 WHERE id=?").run(id);
 audit(req.user.id,"ban",id,req.body.reason||"");
 for(const [socketId,userId] of online) if(userId===id) io.to(socketId).emit("account:banned");
 res.json({ok:true});
});
app.post("/api/admin/player/:id/unban",auth,allow("owner","manager","admin"),(req,res)=>{
 const id=Number(req.params.id);
 db.prepare("UPDATE users SET banned=0 WHERE id=?").run(id);
 audit(req.user.id,"unban",id,"");
 res.json({ok:true});
});
app.post("/api/owner/role",auth,allow("owner"),(req,res)=>{
 const id=Number(req.body.userId);
 const role=String(req.body.role||"");
 if(!roles.includes(role) || role==="owner") return res.status(400).json({error:"نقش نامعتبر است"});
 const target=db.prepare("SELECT id,role FROM users WHERE id=?").get(id);
 if(!target || target.role==="owner") return res.status(404).json({error:"کاربر پیدا نشد"});
 db.prepare("UPDATE users SET role=? WHERE id=?").run(role,id);
 audit(req.user.id,"set_role",id,role);
 res.json({ok:true});
});
app.get("/api/admin/audit",auth,allow("owner","manager"),(req,res)=>{
 res.json({events:db.prepare("SELECT audit.*,users.username actor FROM audit LEFT JOIN users ON users.id=audit.actor_id ORDER BY audit.id DESC LIMIT 100").all()});
});
app.post("/api/reports",auth,(req,res)=>{
 const target=String(req.body.target||"").trim().slice(0,40);
 const reason=String(req.body.reason||"").trim().slice(0,500);
 if(!target || reason.length<5) return res.status(400).json({error:"اطلاعات گزارش کامل نیست"});
 const result=db.prepare("INSERT INTO reports(reporter_id,target_username,reason) VALUES(?,?,?)").run(req.user.id,target,reason);
 res.status(201).json({id:Number(result.lastInsertRowid)});
});
app.get("/api/admin/reports",auth,allow("owner","manager","admin","moderator"),(req,res)=>{
 res.json({reports:db.prepare("SELECT reports.*,users.username reporter FROM reports JOIN users ON users.id=reports.reporter_id ORDER BY reports.id DESC LIMIT 100").all()});
});
io.use((socket,next)=>{
 try {
  const payload=jwt.verify(socket.handshake.auth?.token||"",SECRET);
  const user=db.prepare("SELECT id,username,banned FROM users WHERE id=?").get(payload.id);
  if(!user || user.banned) return next(new Error("unauthorized"));
  socket.user=user; next();
 } catch { next(new Error("unauthorized")); }
});
io.on("connection",socket=>{
 online.set(socket.id,socket.user.id);
 socket.emit("presence:update",{online:online.size});
 socket.broadcast.emit("presence:update",{online:online.size});
 socket.on("player:move",data=>{
  if(!data || !Number.isFinite(data.x)||!Number.isFinite(data.y)||!Number.isFinite(data.z)) return;
  socket.to("world").emit("player:moved",{id:socket.user.id,x:data.x,y:data.y,z:data.z});
 });
 socket.join("world");
 socket.on("disconnect",()=>{
  online.delete(socket.id);
  io.emit("presence:update",{online:online.size});
 });
});
httpServer.listen(PORT,()=>console.log("OpenLife server listening on "+PORT));
