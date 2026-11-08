const $=id=>document.getElementById(id);
let token=sessionStorage.getItem("openlife_admin_token")||"";
let currentUser=null;
function message(text){$("notice").textContent=text;$("notice").classList.remove("hidden")}
function hideMessage(){$("notice").classList.add("hidden")}
async function api(path,options={}){
 const headers={"Content-Type":"application/json",...(options.headers||{})};
 if(token)headers.Authorization="Bearer "+token;
 const response=await fetch(path,{...options,headers});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||("خطای سرور: "+response.status));
 return data;
}
function showDashboard(user){
 currentUser=user;$("login").classList.add("hidden");$("dashboard").classList.remove("hidden");$("logout").classList.remove("hidden");
 $("rolesPanel").classList.toggle("hidden",user.role!=="owner");refresh();
}
async function refresh(){
 try{const d=await api("/api/admin/overview");$("stats").replaceChildren();
 [["کل حساب‌ها",d.total],["آنلاین",d.online],["مسدود",d.banned],["گزارش باز",d.openReports]].forEach(([label,value])=>{const box=document.createElement("div");box.className="stat";const small=document.createElement("span");small.textContent=label;const strong=document.createElement("b");strong.textContent=value;box.append(small,strong);$("stats").append(box)});}
 catch(e){message(e.message)}
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();hideMessage();try{const d=await api("/api/login",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});if(!["owner","manager","admin","moderator"].includes(d.user.role)){message("این حساب دسترسی مدیریت ندارد.");return}token=d.token;sessionStorage.setItem("openlife_admin_token",token);showDashboard(d.user)}catch(err){message(err.message)}});
$("logout").addEventListener("click",()=>{token="";currentUser=null;sessionStorage.removeItem("openlife_admin_token");$("dashboard").classList.add("hidden");$("login").classList.remove("hidden");$("logout").classList.add("hidden")});
$("refresh").addEventListener("click",refresh);
$("searchForm").addEventListener("submit",async e=>{e.preventDefault();try{const d=await api("/api/admin/players?q="+encodeURIComponent($("query").value));renderPlayers(d.players)}catch(err){message(err.message)}});
function renderPlayers(players){
 $("players").replaceChildren();$("roles").replaceChildren();
 for(const p of players){
  const tr=document.createElement("tr");
  const name=document.createElement("td");name.textContent=p.username+" (#"+p.id+")";
  const role=document.createElement("td");role.textContent=p.role;
  const status=document.createElement("td");status.textContent=p.banned?"مسدود":(p.online?"آنلاین":"آفلاین");
  const ops=document.createElement("td");const group=document.createElement("div");group.className="row";
  const warn=document.createElement("button");warn.textContent="اخطار";warn.className="secondary";warn.onclick=async()=>{const reason=prompt("دلیل اخطار را بنویس:");if(reason===null)return;try{await api("/api/admin/player/"+p.id+"/warn",{method:"POST",body:JSON.stringify({reason})});message("اخطار ثبت شد.")}catch(e){message(e.message)}};
  const ban=document.createElement("button");ban.textContent=p.banned?"رفع مسدودی":"مسدود";ban.className=p.banned?"secondary":"danger";ban.onclick=async()=>{if(!confirm("این عملیات را تأیید می‌کنی؟"))return;try{await api("/api/admin/player/"+p.id+(p.banned?"/unban":"/ban"),{method:"POST",body:JSON.stringify({reason:"اقدام از پنل مدیریت"})});message("عملیات انجام شد.");$("searchForm").requestSubmit();refresh()}catch(e){message(e.message)}};
  group.append(warn,ban);ops.append(group);tr.append(name,role,status,ops);$("players").append(tr);
  if(currentUser?.role==="owner"&&p.role!=="owner"){
   const rr=document.createElement("tr"),n=document.createElement("td");n.textContent=p.username;
   const sel=document.createElement("select");["player","moderator","admin","manager"].forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;o.selected=v===p.role;sel.append(o)});
   const cell=document.createElement("td");cell.append(sel);const saveCell=document.createElement("td");const save=document.createElement("button");save.textContent="ذخیره";save.onclick=async()=>{try{await api("/api/owner/role",{method:"POST",body:JSON.stringify({userId:p.id,role:sel.value})});message("نقش تغییر کرد.");$("searchForm").requestSubmit()}catch(e){message(e.message)}};saveCell.append(save);rr.append(n,cell,saveCell);$("roles").append(rr);
  }
 }
}
$("loadReports").addEventListener("click",async()=>{try{const d=await api("/api/admin/reports");$("reports").replaceChildren();for(const r of d.reports){const item=document.createElement("div");item.className="panel";const title=document.createElement("b");title.textContent="#"+r.id+" — "+r.target_username+" ("+r.status+")";const body=document.createElement("p");body.textContent=r.reason;item.append(title,body);if(r.status==="open"){const btn=document.createElement("button");btn.textContent="بستن گزارش";btn.onclick=async()=>{try{await api("/api/admin/report/"+r.id+"/resolve",{method:"POST"});message("گزارش بسته شد.");$("loadReports").click();refresh()}catch(e){message(e.message)}};item.append(btn)}$("reports").append(item)}}catch(e){message(e.message)}});
$("loadAudit").addEventListener("click",async()=>{try{const d=await api("/api/admin/audit");$("audit").replaceChildren();for(const a of d.events){const p=document.createElement("p");p.textContent="#"+a.id+" | "+(a.actor||"سیستم")+" | "+a.action+" | "+(a.detail||"");$("audit").append(p)}}catch(e){message(e.message)}});
if(token){api("/api/me").then(d=>{if(["owner","manager","admin","moderator"].includes(d.user.role))showDashboard(d.user);else throw new Error("دسترسی مدیریت ندارید")}).catch(()=>{$("login").classList.remove("hidden");token="";sessionStorage.removeItem("openlife_admin_token")})}
