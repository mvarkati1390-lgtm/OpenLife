const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test("HTTP API registration, authentication, and movement validation", { skip: !process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL }, async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ["index.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: "test-secret-that-is-long-enough-for-jwt",
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      CORS_ORIGIN: "http://localhost"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let logs = "";
  child.stdout.on("data", chunk => { logs += chunk.toString(); });
  child.stderr.on("data", chunk => { logs += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  const username = "test_" + Date.now().toString(36);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) break;
      try { const response = await fetch(base + "/health"); if (response.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.equal(ready, true, "server did not start: " + logs);
    const adminPage = await fetch(base + "/admin/");
    assert.equal(adminPage.status, 200);
    assert.match(await adminPage.text(), /مدیریت OpenLife/);
    const invalid = await fetch(base + "/api/register", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:"ab",password:"long-enough-password"}) });
    assert.equal(invalid.status,400);
    const registration = await fetch(base + "/api/register", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username,password:"long-enough-password"}) });
    assert.equal(registration.status,201);
    const account = await registration.json();
    assert.ok(account.token);
    assert.equal(account.user.username,username);
    const me = await fetch(base + "/api/me",{headers:{Authorization:"Bearer "+account.token}});
    assert.equal(me.status,200);
    const profile = await me.json();
    assert.equal(profile.user.username,username);
    assert.equal(profile.profile.coins,100);
    assert.equal((await fetch(base+"/api/me")).status,401);
    const bad = await fetch(base+"/api/world/position",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+account.token},body:JSON.stringify({x:1e9,y:0,z:0})});
    assert.equal(bad.status,400);
    const good = await fetch(base+"/api/world/position",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+account.token},body:JSON.stringify({x:1,y:0,z:-2})});
    assert.equal(good.status,200);
    assert.deepEqual(await good.json(),{ok:true});
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once("exit",resolve);setTimeout(resolve,3000);});
  }
});
