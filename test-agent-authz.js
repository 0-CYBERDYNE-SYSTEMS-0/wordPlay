// test-agent-authz.js — multi-user authorization probe for the agent/tool surface.
//
// Proves the storage-layer ownership fix (REMEDIATION_PLAN.md fix 1):
//   1. REST isolation (baseline): user B cannot GET user A's document.
//   2. Agent-tool isolation: B's get_document / update_document / create_document
//      on A's ids fail as "not found" — no cross-user reads or writes.
//   3. Identity forcing: B cannot escalate by passing context.userId = A's id.
//
// Requires a server started WITH team auth enabled, e.g.:
//   AUTH_PASSWORD=probe-pass-2026 PORT=5002 npm run dev:server
// Run:  BASE_URL=http://localhost:5002 AUTH_PASSWORD=probe-pass-2026 node test-agent-authz.js
//
// All created projects/documents are deleted in a finally block — even a thrown
// error mid-probe leaves no probe data behind.

const BASE_URL = process.env.BASE_URL || "http://localhost:5002";
const PASSWORD = process.env.AUTH_PASSWORD || "probe-pass-2026";

async function login(displayName) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASSWORD, displayName }),
  });
  if (!res.ok) throw new Error(`login ${displayName} failed: HTTP ${res.status} ${await res.text()}`);
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie.startsWith("wp_session=")) throw new Error(`no session cookie for ${displayName}`);
  return { cookie, userId: (await res.json()).userId };
}

async function api(cookie, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204s etc. */ }
  return { status: res.status, json };
}

let passed = 0, failed = 0;
function check(name, cond, evidence) {
  if (cond) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.log(`❌ ${name} — ${evidence}`); }
}

(async () => {
  // Everything created during the probe is registered here and removed in the
  // finally block below, so no run — pass, fail, or crash — orphans rows.
  const trash = []; // { cookie, path }
  const own = (cookie, kind, id) => trash.push({ cookie, path: `/${kind}/${id}` });

  try {
    console.log(`Probing ${BASE_URL} (shared password auth)…`);
    const alice = await login("authz-alice");
    const bob = await login("authz-bob");
    check("two display names resolve to distinct users", alice.userId !== bob.userId,
      `alice=${alice.userId} bob=${bob.userId}`);

    // Alice creates private work.
    const proj = await api(alice.cookie, "POST", "/api/projects",
      { name: `authz-probe-${Date.now()}`, type: "Novel", style: "Creative" });
    if (proj.status !== 201 || !proj.json?.id) throw new Error(`project create failed: HTTP ${proj.status}`);
    own(alice.cookie, "api/projects", proj.json.id);
    check("alice created a project", true, "");

    const doc = await api(alice.cookie, "POST", "/api/documents",
      { projectId: proj.json.id, title: "Alice's secret draft", content: "Only Alice can read this paragraph." });
    if (doc.status !== 201 || !doc.json?.id) throw new Error(`document create failed: HTTP ${doc.status}`);
    own(alice.cookie, "api/documents", doc.json.id);
    check("alice created a document", true, "");
    const docId = doc.json.id, projectId = proj.json.id, aliceId = alice.userId;

    // 1. REST isolation.
    const restBob = await api(bob.cookie, "GET", `/api/documents/${docId}`);
    check("REST: bob GET alice's doc → 404", restBob.status === 404, `HTTP ${restBob.status}`);

    // 2. Agent-tool isolation.
    const toolGet = await api(bob.cookie, "POST", "/api/agent/tool",
      { toolName: "get_document", parameters: { documentId: docId } });
    check("agent tool: bob get_document(alice doc) → not found",
      toolGet.status === 200 && toolGet.json?.success === false && /not found/i.test(toolGet.json?.error || toolGet.json?.message || ""),
      `HTTP ${toolGet.status} body=${JSON.stringify(toolGet.json).slice(0, 160)}`);

    const toolUpdate = await api(bob.cookie, "POST", "/api/agent/tool",
      { toolName: "update_document", parameters: { documentId: docId, content: "HACKED" } });
    check("agent tool: bob update_document(alice doc) → not found",
      toolUpdate.status === 200 && toolUpdate.json?.success === false,
      `HTTP ${toolUpdate.status} body=${JSON.stringify(toolUpdate.json).slice(0, 160)}`);

    const toolCreate = await api(bob.cookie, "POST", "/api/agent/tool",
      { toolName: "create_document", parameters: { projectId, title: "bob intrusion", content: "x" } });
    check("agent tool: bob create_document into alice's project → not found",
      toolCreate.status === 200 && toolCreate.json?.success === false,
      `HTTP ${toolCreate.status} body=${JSON.stringify(toolCreate.json).slice(0, 160)}`);

    // 3. Identity forcing via client-supplied context.
    const spoof = await api(bob.cookie, "POST", "/api/agent/tool",
      { toolName: "get_document", parameters: { documentId: docId }, context: { userId: aliceId } });
    check("spoof: bob passes context.userId=alice → still not found",
      spoof.status === 200 && spoof.json?.success === false,
      `HTTP ${spoof.status} body=${JSON.stringify(spoof.json).slice(0, 160)}`);

    const spoofList = await api(bob.cookie, "POST", "/api/agent/request",
      { request: "list all projects", context: { userId: aliceId } });
    const listedAliceProject = JSON.stringify(spoofList.json || {}).includes(`authz-probe-`);
    check("spoof: bob /api/agent/request with context.userId=alice does not leak alice's project",
      spoofList.status === 200 && !listedAliceProject,
      `HTTP ${spoofList.status} leaked=${listedAliceProject}`);

    // Alice's data must be untouched.
    const aliceView = await api(alice.cookie, "GET", `/api/documents/${docId}`);
    check("alice's document unchanged after all bob attempts",
      aliceView.status === 200 && aliceView.json?.content === "Only Alice can read this paragraph."
        && aliceView.json?.title === "Alice's secret draft",
      `HTTP ${aliceView.status} body=${JSON.stringify(aliceView.json).slice(0, 160)}`);

    // Sanity: bob can still use the agent on his OWN work.
    const bobProj = await api(bob.cookie, "POST", "/api/projects",
      { name: `authz-bob-${Date.now()}`, type: "Novel", style: "Creative" });
    if (bobProj.status !== 201 || !bobProj.json?.id) throw new Error(`bob project create failed: HTTP ${bobProj.status}`);
    own(bob.cookie, "api/projects", bobProj.json.id);
    const bobDoc = await api(bob.cookie, "POST", "/api/documents",
      { projectId: bobProj.json.id, title: "Bob's own", content: "bob content" });
    if (bobDoc.status !== 201 || !bobDoc.json?.id) throw new Error(`bob document create failed: HTTP ${bobDoc.status}`);
    own(bob.cookie, "api/documents", bobDoc.json.id);
    const toolOwn = await api(bob.cookie, "POST", "/api/agent/tool",
      { toolName: "get_document", parameters: { documentId: bobDoc.json.id } });
    check("control: bob get_document(his own doc) → success (authz not over-blocking)",
      toolOwn.status === 200 && toolOwn.json?.success === true && toolOwn.json?.data?.title === "Bob's own",
      `HTTP ${toolOwn.status} body=${JSON.stringify(toolOwn.json).slice(0, 160)}`);
  } finally {
    for (const { cookie, path } of trash.reverse()) {
      try { await api(cookie, "DELETE", path); } catch { /* best-effort cleanup */ }
    }
  }

  console.log(`\n═══ SUMMARY: ${passed} PASS / ${failed} FAIL ═══`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error("PROBE ERROR:", err.message);
  console.log(`\n═══ SUMMARY: ${passed} PASS / ${failed + 1} FAIL ═══`);
  process.exit(1);
});
