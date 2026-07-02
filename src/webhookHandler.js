import { buildDescription, buildCustomFields, determinePriority } from "./fieldMapper.js";
import { findTaskByGHLId, createTask, updateTask } from "./clickupClient.js";

const LIST_ID      = process.env.CLICKUP_LIST_ID;
const GHL_ID_FIELD = process.env.CU_FIELD_GHL_ID;

export async function handleGHLWebhook(payload) {
  if (!LIST_ID) throw new Error("CLICKUP_LIST_ID env var is not set");

  const contactId = payload.contact_id || payload.contactId || payload.contact?.id;
  const firstName = payload.first_name || payload.firstName || payload.contact?.firstName || "";
  const lastName  = payload.last_name  || payload.lastName  || payload.contact?.lastName  || "";
  const fullName  = payload.full_name  || `${firstName} ${lastName}`.trim();
  const email     = payload.email      || payload.contact?.email || "";
  const phone     = payload.phone      || payload.contact?.phone || "";
  const company   = payload.company_name || payload.companyName || payload.contact?.companyName || "";

  // Opportunity fields — try every possible field name GHL might use
  const value     = payload.lead_value || payload.value || payload.opportunity_value || payload.monetary_value || payload.monetaryValue || 0;
  const pipeline  = payload.pipeline_name || payload.pipelineName || payload.pipeline || "";
  const stage     = payload.pipleline_stage || payload.pipeline_stage || payload.pipelineStageName || payload.stage || "";
  const owner     = payload.owner || payload.assigned_to || payload.assignedTo || payload.opportunity?.assignedTo || "";
  const oppName   = payload.opportunity_name || payload.name || fullName;

  console.log(`🏆 Won deal: ${fullName} | Contact: ${contactId} | Value: $${value} | Owner: ${owner} | Pipeline: ${pipeline} | Stage: ${stage}`);

  const normalizedPayload = {
    contact: { id: contactId, firstName, lastName, email, phone, companyName: company },
    opportunity: { 
      name: oppName, 
      monetaryValue: value,
      value: value,
      status: "won",
      pipelineName: pipeline,
      pipelineStageName: stage,
      assignedTo: owner,
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
