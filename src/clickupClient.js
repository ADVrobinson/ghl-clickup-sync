const BASE_URL = "https://api.clickup.com/api/v2";

function headers() {
  return {
    Authorization: process.env.CLICKUP_API_TOKEN,
    "Content-Type": "application/json",
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`ClickUp API error ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

export async function findTaskByGHLId(listId, ghlContactId, ghlFieldId) {
  if (!ghlFieldId || ghlFieldId.startsWith("REPLACE")) return null;
  const data = await request("GET", `/list/${listId}/task?custom_fields=[{"field_id":"${ghlFieldId}","operator":"=","value":"${ghlContactId}"}]`);
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
