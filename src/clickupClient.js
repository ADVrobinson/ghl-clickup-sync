const BASE_URL = "https://api.clickup.com/api/v2";

// ── Rate-limit settings ─────────────────────────────────────────────
// ClickUp allows ~100 requests/min per token. Spacing calls 700ms apart
// keeps this service at ~85/min max, and 429s are retried automatically.
const MIN_GAP_MS = 700;
const MAX_RETRIES = 5;

let queue = Promise.resolve();
let lastCall = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers() {
  return {
    Authorization: process.env.CLICKUP_API_TOKEN,
    "Content-Type": "application/json",
  };
}

// All ClickUp calls go through one queue so a burst of GHL webhooks
// can't fire dozens of requests at the same moment.
function request(method, path, body) {
  const run = () => send(method, path, body);
  const result = queue.then(run, run);
  queue = result.catch(() => {}); // keep the queue alive after an error
  return result;
}

async function send(method, path, body, attempt = 0) {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  // 429 Rate limit → wait until ClickUp's reset time, then retry
  if (res.status === 429 && attempt < MAX_RETRIES) {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    const waitMs = reset ? Math.max(reset - Date.now(), 1000) + 500 : 15000;
    console.warn(`⏳ ClickUp 429 on ${method} ${path} — retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
    await sleep(waitMs);
    return send(method, path, body, attempt + 1);
  }

  // 5xx ClickUp server error → short backoff, then retry
  if (res.status >= 500 && attempt < MAX_RETRIES) {
    const waitMs = 2000 * (attempt + 1);
    console.warn(`⚠️ ClickUp ${res.status} on ${method} ${path} — retrying in ${waitMs / 1000}s`);
    await sleep(waitMs);
    return send(method, path, body, attempt + 1);
  }

  // Parse safely — ClickUp sometimes returns non-JSON error pages
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }

  if (!res.ok) throw new Error(`ClickUp API error ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Exports (same signatures as before) ─────────────────────────────

export async function findTaskByGHLId(listId, ghlContactId, ghlFieldId) {
  if (!ghlFieldId || ghlFieldId.startsWith("REPLACE")) return null;
  const filter = encodeURIComponent(
    JSON.stringify([{ field_id: ghlFieldId, operator: "=", value: String(ghlContactId) }])
  );
  // include_closed=true so a closed/completed task still counts as a match (prevents duplicates)
  const data = await request("GET", `/list/${listId}/task?include_closed=true&custom_fields=${filter}`);
  return data.tasks?.[0] || null;
}

export async function createTask(listId, payload) {
  return request("POST", `/list/${listId}/task`, payload);
}

export async function updateTask(taskId, payload) {
  return request("PUT", `/task/${taskId}`, payload);
}

export async function addComment(taskId, commentText) {
  return request("POST", `/task/${taskId}/comment`, { comment_text: commentText, notify_all: false });
}

// Custom fields can't be set via PUT /task — ClickUp needs one call per field
export async function setCustomField(taskId, fieldId, value) {
  return request("POST", `/task/${taskId}/field/${fieldId}`, { value });
}
