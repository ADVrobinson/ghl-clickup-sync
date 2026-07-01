import { buildDescription, buildCustomFields, determinePriority } from "./fieldMapper.js";
import { findTaskByGHLId, createTask, updateTask } from "./clickupClient.js";

const LIST_ID      = process.env.CLICKUP_LIST_ID;
const GHL_ID_FIELD = process.env.CU_FIELD_GHL_ID;

export async function handleGHLWebhook(payload) {
  if (!LIST_ID) throw new Error("CLICKUP_LIST_ID env var is not set");

  const contactId = payload.contactId || payload.contact?.id || payload.id;
  const firstName = payload.firstName || payload.contact?.firstName || "";
  const lastName  = payload.lastName  || payload.contact?.lastName  || "";
  const email     = payload.email     || payload.contact?.email     || "";
  const phone     = payload.phone     || payload.contact?.phone     || "";
  const company   = payload.companyName || payload.businessName || payload.contact?.companyName || "";
  const value     = payload.monetaryValue || payload.opportunityValue || payload.value || 0;
  const oppName   = payload.name || `${firstName} ${lastName}`.trim();

  console.log(`🏆 Won deal: ${oppName} | Contact: ${contactId} | Value: $${value}`);

  const normalizedPayload = {
    contact: { id: contactId, firstName, lastName, email, phone, companyName: company },
    opportunity: { name: oppName, monetaryValue: value, status: "won" },
    ...payload
  };

  const taskPayload = {
    name: `${firstName} ${lastName}`.trim() || oppName || "New Won Client",
    description: buildDescription(normalizedPayload),
    priority: determinePriority(normalizedPayload),
    status: "To Do",
    custom_fields: buildCustomFields(normalizedPayload, "closed_deal"),
    tags: ["ghl-won"],
  };

  const existing = await findTaskByGHLId(LIST_ID, contactId, GHL_ID_FIELD);

  if (existing) {
    await updateTask(existing.id, taskPayload);
    console.log(`✅ Updated existing task: ${existing.id}`);
    return { action: "updated", taskId: existing.id };
  }

  const task = await createTask(LIST_ID, taskPayload);
  console.log(`✅ Created new task: ${task.id} — ${task.name}`);
  return { action: "created", taskId: task.id };
}
