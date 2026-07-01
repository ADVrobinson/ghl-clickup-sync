const FIELDS = {
  ghlContactId:  process.env.CU_FIELD_GHL_ID,
  email:         process.env.CU_FIELD_EMAIL,
  phone:         process.env.CU_FIELD_PHONE,
  businessName:  process.env.CU_FIELD_BUSINESS_NAME,
  companyName:   process.env.CU_FIELD_COMPANY_NAME,
  totalContract: process.env.CU_FIELD_TOTAL_CONTRACT,
  payment1:      process.env.CU_FIELD_PAYMENT1,
  payment2:      process.env.CU_FIELD_PAYMENT2,
  payment3:      process.env.CU_FIELD_PAYMENT3,
  notes:         process.env.CU_FIELD_NOTES,
  clientStatus:  process.env.CU_FIELD_CLIENT_STATUS,
  pmAssigned:    process.env.CU_FIELD_PM_ASSIGNED,
  tags:          process.env.CU_FIELD_TAGS,
};

export const CLIENT_STATUS = {
  "closed_deal":     "769e69bd-dc6d-4bd7-9493-bab9c2496fa2",
  "invoice_paid":    "4005f1ca-b009-4488-a6b4-b932613e62e4",
  "onboarding":      "a03e2fba-9b72-4ca5-8071-049b183d3507",
  "active_client":   "e12cf8eb-4155-4804-a0b1-0ca2921d575a",
  "pending_payment": "7f79b3f5-6237-400e-ab1c-8ed2963992d8",
  "inactive":        "8bcb5857-d27e-491d-b2e7-9ae8d5354c40",
  "cancelled":       "90bf711b-f4ef-455b-8853-f1976ef53a12",
  "paused":          "053463e0-b94c-4a0d-a6fe-fe433509f988",
  "completed":       "edc96b0e-2e5d-42b1-9698-f3e1a1e0db8e",
};

export const PM_OPTIONS = {
  "aldrin":   "519a9e07-edf6-48a6-948c-56c2f70d2c16",
  "alexis":   "9e91e67f-6a3b-44b7-a78a-c0f076987ddd",
  "brendan":  "717bfa0a-5c7e-4da1-a50d-2aa180a53ef2",
  "jan":      "03f98129-90df-4a71-980d-6162228faee6",
  "liz":      "54c9e1f6-f764-4806-889b-cb4381e52b13",
  "patricia": "8ee1b879-23d0-4bb5-9e3a-09d4ba2df798",
};

export function buildTaskName(ghlData) {
  const isOpp = ghlData.type === "OpportunityCreate" || ghlData.type === "OpportunityUpdate";
  if (isOpp) {
    const name = ghlData.opportunity?.name || ghlData.contact?.fullName || "Unnamed Opportunity";
    return `[OPP] ${name}`;
  }
  const first = ghlData.contact?.firstName || ghlData.firstName || "";
  const last  = ghlData.contact?.lastName  || ghlData.lastName  || "";
  const full  = `${first} ${last}`.trim() || ghlData.contact?.email || "Unnamed Contact";
  return `[LEAD] ${full}`;
}

export function buildDescription(ghlData) {
  const c   = ghlData.contact || ghlData;
  const opp = ghlData.opportunity || {};
  const lines = [
    "## Contact Info",
    `- **Name:** ${c.firstName || ""} ${c.lastName || ""}`.trim(),
    `- **Email:** ${c.email || "—"}`,
    `- **Phone:** ${c.phone || c.mobilePhone || "—"}`,
    `- **Business:** ${c.companyName || c.company || "—"}`,
    `- **Source:** ${c.source || "—"}`,
    "",
  ];
  if (opp.name) {
    lines.push("## Opportunity",
      `- **Pipeline:** ${opp.pipelineName || opp.pipeline || "—"}`,
      `- **Stage:** ${opp.pipelineStageName || opp.stage || "—"}`,
      `- **Value:** $${opp.monetaryValue || opp.value || "0"}`,
      `- **Status:** ${opp.status || "—"}`, "");
  }
  if (ghlData.notes || ghlData.note) lines.push("## Notes", ghlData.notes || ghlData.note, "");
  lines.push("---", `*Synced from GoHighLevel • ${new Date().toISOString()}*`);
  return lines.join("\n");
}

export function buildCustomFields(ghlData) {
  const c   = ghlData.contact || ghlData;
  const opp = ghlData.opportunity || {};
  const statusKey = opp.status?.toLowerCase().replace(/\s+/g, "_");
  const clientStatusId = CLIENT_STATUS[statusKey] || null;
  const raw = [
    [FIELDS.ghlContactId,  c.id || ghlData.contactId],
    [FIELDS.email,         c.email],
    [FIELDS.phone,         c.phone || c.mobilePhone],
    [FIELDS.businessName,  c.companyName || c.company],
    [FIELDS.companyName,   c.companyName || c.company],
    [FIELDS.totalContract, opp.monetaryValue || opp.value],
    [FIELDS.notes,         ghlData.notes || ghlData.note],
    [FIELDS.clientStatus,  clientStatusId],
  ];
  return raw
    .filter(([id, val]) => id && val !== undefined && val !== null && val !== "")
    .map(([id, val]) => ({ id, value: String(val) }));
}

export function determinePriority(ghlData) {
  const value = parseFloat(ghlData.opportunity?.monetaryValue || 0);
  if (value >= 10000) return 1;
  if (value >= 5000)  return 2;
  if (value >= 1000)  return 3;
  return 4;
}
