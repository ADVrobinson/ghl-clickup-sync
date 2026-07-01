import { buildTaskName, buildDescription, buildCustomFields, determinePriority } from "./fieldMapper.js";
import { findTaskByGHLId, createTask, updateTask, addComment } from "./clickupClient.js";

const LIST_ID      = process.env.CLICKUP_LIST_ID;
const GHL_ID_FIELD = process.env.CU_FIELD_GHL_ID;

const STATUS_MAP = {
  open: "To Do", won: "Won", lost: "Lost", abandoned: "Abandoned",
};

export async function handleGHLWebhook(payload) {
  if (!LIST_ID) throw new Error("CLICKUP_LIST_ID env var is not set");
  const { type } = payload;
  console.log(`🔄 Processing event: ${type}`);
  switch (type) {
    case "ContactCreate":         return handleContactCreate(payload);
    case "ContactUpdate":         return handleContactUpdate(payload);
    case "OpportunityCreate":     return handleOpportunityCreate(payload);
    case "OpportunityUpdate":
    case "OpportunityStageUpdate":return handleOpportunityUpdate(payload);
    case "NoteCreate":            return handleNoteCreate(payload);
    default:
      console.log(`ℹ️  Unhandled event type: ${type}`);
      return { skipped: true, type };
  }
}

async function handleContactCreate(payload) {
  const ghlId = payload.contact?.id || payload.contactId;
  const existing = await findTaskByGHLId(LIST_ID, ghlId, GHL_ID_FIELD);
  if (existing) return { action: "skipped", taskId: existing.id };
  const task = await createTask(LIST_ID, {
    name: buildTaskName(payload),
    description: buildDescription(payload),
    status: "To Do",
    priority: 4,
    custom_fields: buildCustomFields(payload),
    tags: ["ghl-lead"],
  });
  console.log(`✅ Created task: ${task.id}`);
  return { action: "created", taskId: task.id };
}

async function handleContactUpdate(payload) {
  const ghlId = payload.contact?.id || payload.contactId;
  const existing = await findTaskByGHLId(LIST_ID, ghlId, GHL_ID_FIELD);
  if (!existing) return handleContactCreate(payload);
  await updateTask(existing.id, {
    name: buildTaskName(payload),
    description: buildDescription(payload),
    custom_fields: buildCustomFields(payload),
  });
  console.log(`✅ Updated task: ${existing.id}`);
  return { action: "updated", taskId: existing.id };
}

async function handleOpportunityCreate(payload) {
  const ghlId = payload.contact?.id || payload.contactId;
  const existing = await findTaskByGHLId(LIST_ID, ghlId, GHL_ID_FIELD);
  const opp = payload.opportunity || {};
  if (existing) {
    await updateTask(existing.id, {
      name: buildTaskName(payload),
      description: buildDescription(payload),
      priority: determinePriority(payload),
      status: STATUS_MAP[opp.status] || "To Do",
      custom_fields: buildCustomFields(payload),
    });
    return { action: "upgraded", taskId: existing.id };
  }
  const task = await createTask(LIST_ID, {
    name: buildTaskName(payload),
    description: buildDescription(payload),
    priority: determinePriority(payload),
    status: "To Do",
    custom_fields: buildCustomFields(payload),
    tags: ["ghl-opportunity"],
  });
  console.log(`✅ Created opportunity task: ${task.id}`);
  return { action: "created", taskId: task.id };
}

async function handleOpportunityUpdate(payload) {
  const ghlId = payload.contact?.id || payload.contactId;
  const existing = await findTaskByGHLId(LIST_ID, ghlId, GHL_ID_FIELD);
  if (!existing) return handleOpportunityCreate(payload);
  const opp = payload.opportunity || {};
  await updateTask(existing.id, {
    description: buildDescription(payload),
    priority: determinePriority(payload),
    status: STATUS_MAP[opp.status] || undefined,
    custom_fields: buildCustomFields(payload),
  });
  return { action: "updated", taskId: existing.id };
}

async function handleNoteCreate(payload) {
  const ghlId = payload.contactId || payload.contact?.id;
  const note  = payload.note || payload.body || payload.text || "New note from GHL";
  const existing = await findTaskByGHLId(LIST_ID, ghlId, GHL_ID_FIELD);
  if (!existing) return { action: "skipped", reason: "no matching task" };
  await addComment(existing.id, `📝 **GHL Note:**\n\n${note}`);
  return { action: "note_added", taskId: existing.id };
}
