const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test("HTTP API registration, authentication, and movement validation", async () => {
  const port = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openlife-test-"));
  const child = spawn(process.execPath, ["index.js"], {
    cwd: __dirname.replace(/[\\/]test$/, ""),
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: "test-secret-that-is-long-enough-for-jwt",
      DB_FILE: path.join(tempDir, "test.db"),
      CORS_ORIGIN: "http://localhost"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", chunk => { logs += chunk.toString(); });
  child.stderr.on("data", chunk => { logs += chunk.toString(); });

  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch(base + "/health");
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "server did not start: " + logs);

    const invalid = await fetch(base + "/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "ab", password: "long-enough-password" })
    });
    assert.equal(invalid.status, 400);

    const registration = await fetch(base + "/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test_player1", password: "long-enough-password" })
    });
    assert.equal(registration.status, 201);
    const account = await registration.json();
    assert.ok(account.token);
    assert.equal(account.user.username, "test_player1");

    const me = await fetch(base + "/api/me", {
      headers: { Authorization: "Bearer " + account.token }
    });
    assert.equal(me.status, 200);
    const profile = await me.json();
    assert.equal(profile.user.username, "test_player1");
    assert.equal(profile.profile.coins, 100);

    const unauthorized = await fetch(base + "/api/me");
    assert.equal(unauthorized.status, 401);

    const badPosition = await fetch(base + "/api/world/position", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + account.token },
      body: JSON.stringify({ x: 1e9, y: 0, z: 0 })
    });
    assert.equal(badPosition.status, 400);

    const goodPosition = await fetch(base + "/api/world/position", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + account.token },
      body: JSON.stringify({ x: 1, y: 0, z: -2 })
    });
    assert.equal(goodPosition.status, 200);
    assert.deepEqual(await goodPosition.json(), { ok: true });
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
