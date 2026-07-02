import { buildDescription, buildCustomFields, determinePriority } from "./fieldMapper.js";
import { findTaskByGHLId, createTask, updateTask } from "./clickupClient.js";

const LIST_ID      = process.env.CLICKUP_LIST_ID;
const GHL_ID_FIELD = process.env.CU_FIELD_GHL_ID;

export async function handleGHLWebhook(payload) {
  if (!LIST_ID) throw new Error("CLICKUP_LIST_ID env var is not set");

  // GHL sends fields at root level with snake_case names
  const contactId = payload.contact_id || payload.contactId || payload.contact?.id;
  const firstName = payload.first_name || payload.firstName || payload.contact?.firstName || "";
  const lastName  = payload.last_name  || payload.lastName  || payload.contact?.lastName  || "";
  const fullName  = payload.full_name  || `${firstName} ${lastName}`.trim();
  const email     = payload.email      || payload.contact?.email     || "";
  const phone     = payload.phone      || payload.contact?.phone     || "";
  const company   = payload.company_name || payload.companyName || payload.contact?.companyName || "";
  const value     = payload.monetary_value || payload.monetaryValue || payload.opportunity?.monetaryValue || 0;
  const oppName   = payload.opportunity_name || payload.name || fullName;

  console.log(`🏆 Won deal: ${fullName} | Contact: ${contactId} | Value: $${value}`);

  const normalizedPayload = {
    contact: { 
      id: contactId, 
      firstName, 
      lastName, 
      email, 
      phone, 
      companyName: company 
    },
    opportunity: { 
      name: oppName, 
      monetaryValue: value, 
      status: "won" 
    },
  };

  const taskPayload = {
    name:          fullName || oppName || "New Won Client",
    description:   buildDescription(normalizedPayload),
    priority:      determinePriority(normalizedPayload),
    status:        "Open",
    custom_fields: buildCustomFields(normalizedPayload, "closed_deal"),
    tags:          ["ghl-won"],
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
