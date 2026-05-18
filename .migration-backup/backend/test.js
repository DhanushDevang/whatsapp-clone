const BASE = "http://localhost:5001";
let token1 = "", token2 = "", convId = 0;

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

function pass(tc, msg) { console.log(`✅ ${tc}: ${msg}`); }
function fail(tc, msg) { console.log(`❌ ${tc}: ${msg}`); }
function section(name) { console.log(`\n${"=".repeat(50)}\n🔷 ${name}\n${"=".repeat(50)}`); }

async function run() {
  console.log("🚀 Starting WhatsApp Clone API Tests...\n");

  // ── AUTH TESTS ──
  section("AUTHENTICATION TESTS");

  // TC-A01: Register user 1
  let r = await req("POST", "/api/auth/register", { username: "tester1", email: "tester1@test.com", password: "pass123" });
  if (r.status === 201 && r.data.token) { pass("TC-A01", "Register user 1 ✓"); token1 = r.data.token; }
  else if (r.status === 400 && r.data.message === "User already exists") {
    pass("TC-A01", "User already exists — logging in instead");
    let login = await req("POST", "/api/auth/login", { email: "tester1@test.com", password: "pass123" });
    token1 = login.data.token;
  }
  else fail("TC-A01", `Unexpected: ${JSON.stringify(r.data)}`);

  // TC-A02: Register user 2
  r = await req("POST", "/api/auth/register", { username: "tester2", email: "tester2@test.com", password: "pass123" });
  if (r.status === 201 && r.data.token) { pass("TC-A02", "Register user 2 ✓"); token2 = r.data.token; }
  else if (r.status === 400) {
    pass("TC-A02", "User 2 already exists — logging in");
    let login = await req("POST", "/api/auth/login", { email: "tester2@test.com", password: "pass123" });
    token2 = login.data.token;
  }
  else fail("TC-A02", `Unexpected: ${JSON.stringify(r.data)}`);

  // TC-A03: Duplicate email rejected
  r = await req("POST", "/api/auth/register", { username: "dup", email: "tester1@test.com", password: "pass" });
  r.status === 400 && r.data.message === "User already exists"
    ? pass("TC-A03", "Duplicate email rejected ✓")
    : fail("TC-A03", `Expected 400, got ${r.status}`);

  // TC-A04: Login correct
  r = await req("POST", "/api/auth/login", { email: "tester1@test.com", password: "pass123" });
  r.status === 200 && r.data.token
    ? pass("TC-A04", "Login with correct credentials ✓")
    : fail("TC-A04", `Expected 200, got ${r.status}`);

  // TC-A05: Login wrong password
  r = await req("POST", "/api/auth/login", { email: "tester1@test.com", password: "wrongpass" });
  r.status === 400 && r.data.message === "Invalid credentials"
    ? pass("TC-A05", "Wrong password rejected ✓")
    : fail("TC-A05", `Expected 400, got ${r.status}`);

  // TC-A06: Login non-existent email
  r = await req("POST", "/api/auth/login", { email: "ghost@test.com", password: "pass" });
  r.status === 400 && r.data.message === "Invalid credentials"
    ? pass("TC-A06", "Non-existent email rejected ✓")
    : fail("TC-A06", `Expected 400, got ${r.status}`);

  // TC-A07: No token
  r = await req("GET", "/api/conversations");
  r.status === 401
    ? pass("TC-A07", "No token blocked ✓")
    : fail("TC-A07", `Expected 401, got ${r.status}`);

  // TC-A08: Invalid token
  r = await req("GET", "/api/conversations", null, "faketoken123");
  r.status === 401
    ? pass("TC-A08", "Invalid token blocked ✓")
    : fail("TC-A08", `Expected 401, got ${r.status}`);

  // TC-A09: Find user by email
  r = await req("GET", "/api/auth/find?email=tester2@test.com", null, token1);
  r.status === 200 && r.data.email === "tester2@test.com" && !r.data.password
    ? pass("TC-A09", "Find user by email ✓ (no password exposed)")
    : fail("TC-A09", `Expected user without password, got ${JSON.stringify(r.data)}`);

  // TC-A10: Find non-existent user
  r = await req("GET", "/api/auth/find?email=nobody@test.com", null, token1);
  r.status === 404
    ? pass("TC-A10", "Non-existent user returns 404 ✓")
    : fail("TC-A10", `Expected 404, got ${r.status}`);

  // ── CONVERSATION TESTS ──
  section("CONVERSATION TESTS");

  // TC-C01: Get user2 ID first
  r = await req("GET", "/api/auth/find?email=tester2@test.com", null, token1);
  const user2Id = r.data.id;

  // TC-C02: Create conversation
  r = await req("POST", "/api/conversations", { recipientId: user2Id }, token1);
  if ((r.status === 201 || r.status === 200) && r.data.conversationId) {
    pass("TC-C01", `Create conversation ✓ (id: ${r.data.conversationId}, existing: ${r.data.existing})`);
    convId = r.data.conversationId;
  } else fail("TC-C01", `Expected conversationId, got ${JSON.stringify(r.data)}`);

  // TC-C03: Duplicate conversation returns same ID
  r = await req("POST", "/api/conversations", { recipientId: user2Id }, token1);
  r.data.existing === true && r.data.conversationId === convId
    ? pass("TC-C02", "Duplicate conversation prevented ✓")
    : fail("TC-C02", `Expected existing:true, got ${JSON.stringify(r.data)}`);

  // TC-C04: Self conversation blocked
  r = await req("GET", "/api/auth/find?email=tester1@test.com", null, token1);
  const user1Id = r.data.id;
  r = await req("POST", "/api/conversations", { recipientId: user1Id }, token1);
  r.status === 400
    ? pass("TC-C03", "Self-conversation blocked ✓")
    : fail("TC-C03", `Expected 400, got ${r.status}`);

  // TC-C05: Get conversations
  r = await req("GET", "/api/conversations", null, token1);
  r.status === 200 && Array.isArray(r.data) && r.data.length > 0
    ? pass("TC-C04", `Get conversations ✓ (${r.data.length} found)`)
    : fail("TC-C04", `Expected array with items, got ${JSON.stringify(r.data)}`);

  // TC-C06: New user has empty conversations
  const newUser = await req("POST", "/api/auth/register", { username: "newuser99", email: "newuser99@test.com", password: "pass123" });
  const newToken = newUser.data.token || (await req("POST", "/api/auth/login", { email: "newuser99@test.com", password: "pass123" })).data.token;
  r = await req("GET", "/api/conversations", null, newToken);
  r.status === 200 && Array.isArray(r.data) && r.data.length === 0
    ? pass("TC-C05", "New user has empty conversations ✓")
    : fail("TC-C05", `Expected [], got ${JSON.stringify(r.data)}`);

  // ── MESSAGE TESTS ──
  section("MESSAGE TESTS");

  // TC-M01: Send message
  r = await req("POST", "/api/messages", { conversationId: convId, content: "Hello from test!" }, token1);
  const msgId = r.data.id;
  r.status === 201 && r.data.content === "Hello from test!"
    ? pass("TC-M01", "Send message ✓")
    : fail("TC-M01", `Expected 201, got ${r.status} ${JSON.stringify(r.data)}`);

  // TC-M02: Send second message
  r = await req("POST", "/api/messages", { conversationId: convId, content: "Second message" }, token1);
  r.status === 201
    ? pass("TC-M02", "Send second message ✓")
    : fail("TC-M02", `Expected 201, got ${r.status}`);

  // TC-M03: Fetch messages
  r = await req("GET", `/api/messages/${convId}`, null, token1);
  r.status === 200 && Array.isArray(r.data) && r.data.length >= 2 && r.data[0].sender_username
    ? pass("TC-M03", `Fetch messages ✓ (${r.data.length} messages, sender_username included)`)
    : fail("TC-M03", `Expected messages array, got ${JSON.stringify(r.data)}`);

  // TC-M04: Pagination - limit
  r = await req("GET", `/api/messages/${convId}?limit=1&offset=0`, null, token1);
  r.status === 200 && r.data.length === 1
    ? pass("TC-M04", "Pagination limit=1 ✓")
    : fail("TC-M04", `Expected 1 message, got ${r.data.length}`);

  // TC-M05: Pagination - offset
  r = await req("GET", `/api/messages/${convId}?limit=1&offset=1`, null, token1);
  r.status === 200 && r.data.length === 1
    ? pass("TC-M05", "Pagination offset=1 ✓")
    : fail("TC-M05", `Expected 1 message, got ${r.data.length}`);

  // TC-M06: Unauthorized message access
  r = await req("GET", `/api/messages/${convId}`, null, newToken);
  r.status === 403
    ? pass("TC-M06", "Unauthorized message access blocked ✓")
    : fail("TC-M06", `Expected 403, got ${r.status}`);

  // TC-M07: Send to non-existent conversation
  r = await req("POST", "/api/messages", { conversationId: 99999, content: "hack" }, token1);
  r.status === 403
    ? pass("TC-M07", "Send to non-existent conversation blocked ✓")
    : fail("TC-M07", `Expected 403, got ${r.status}`);

  // ── HEALTH CHECK ──
  section("HEALTH CHECK");
  r = await req("GET", "/");
  r.status === 200 && r.data.message
    ? pass("TC-H01", `Health check ✓ — "${r.data.message}"`)
    : fail("TC-H01", "Health check failed");

  // 404 route
  r = await req("GET", "/api/nonexistent");
  r.status === 404
    ? pass("TC-H02", "Unknown route returns 404 ✓")
    : fail("TC-H02", `Expected 404, got ${r.status}`);

  console.log("\n" + "=".repeat(50));
  console.log("🏁 All tests completed!");
  console.log("=".repeat(50));
}

run().catch(console.error);
