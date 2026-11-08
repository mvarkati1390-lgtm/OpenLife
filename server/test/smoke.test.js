const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test("registration, login and shared world position API", async () => {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openlife-test-"));
  const child = spawn(process.execPath, ["index.js"], {
    cwd: __dirname + "/..",
    env: {
      ...process.env,
      PORT: String(port),
      DB_FILE: path.join(dir, "test.db"),
      JWT_SECRET: "test-secret-that-is-longer-than-thirty-two-characters",
      OWNER_USERNAME: "testowner",
      OWNER_PASSWORD: "test-owner-password-123"
    },
    stdio: "ignore"
  });
  const base = "http://127.0.0.1:" + port;
  async function waitForServer() {
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) throw new Error("Server exited before becoming ready");
      try {
        const response = await fetch(base + "/health");
        if (response.ok) return;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error("Server did not become ready");
  }
  try {
    await waitForServer();
    const register = await fetch(base + "/api/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "player_test", password: "player-password-123" })
    });
    assert.equal(register.status, 201);
    const playerSession = await register.json();
    assert.ok(playerSession.token);

    const position = await fetch(base + "/api/world/position", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + playerSession.token },
      body: JSON.stringify({ x: 12.5, y: 0, z: -8 })
    });
    assert.equal(position.status, 200);

    const ownerLogin = await fetch(base + "/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testowner", password: "test-owner-password-123" })
    });
    assert.equal(ownerLogin.status, 200);
    const ownerSession = await ownerLogin.json();

    const players = await fetch(base + "/api/world/players", {
      headers: { Authorization: "Bearer " + ownerSession.token }
    });
    assert.equal(players.status, 200);
    const data = await players.json();
    assert.equal(data.players.length, 1);
    assert.equal(data.players[0].username, "player_test");
    assert.equal(data.players[0].x, 12.5);
    assert.equal(data.players[0].z, -8);

    const invalidPosition = await fetch(base + "/api/world/position", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + playerSession.token },
      body: JSON.stringify({ x: "bad", y: 0, z: 0 })
    });
    assert.equal(invalidPosition.status, 400);
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve => child.once("exit", resolve).setTimeout?.(3000));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
