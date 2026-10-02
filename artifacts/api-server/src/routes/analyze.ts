import OpenAI from "openai";
import { Router, type IRouter } from "express";

type IncidentAction = "rollback" | "restart" | "scale_up_memory" | "none";
type IncidentDeployment = { revision: number; version: string; status: string };
type IncidentEvidence = {
  metrics_summary: string;
  previous_logs: string[];
  events: string[];
  deploy_history: IncidentDeployment[];
};
type IncidentAnalysis = {
  root_cause_ar: string;
  confidence: number;
  evidence_ar: string[];
  action: IncidentAction;
  action_target: string;
  explanation_ar: string;
};

const router: IRouter = Router();
const ALLOWED_ACTIONS = new Set<IncidentAction>([
  "rollback",
  "restart",
  "scale_up_memory",
  "none",
]);

const systemPrompt =
  "Analyze the Kubernetes incident evidence. Reply only with valid JSON, with the exact keys root_cause_ar, confidence (integer 0-100), evidence_ar (string array), action (one of rollback, restart, scale_up_memory, none), action_target, and explanation_ar. Write all descriptive text in Arabic.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength: number, minLength = 0): value is string {
  return typeof value === "string" && value.length >= minLength && value.length <= maxLength;
}

function parseIncidentEvidence(value: unknown): IncidentEvidence | null {
  if (!isRecord(value) || !isBoundedString(value.metrics_summary, 4000, 1)) return null;
  if (
    !Array.isArray(value.previous_logs) ||
    value.previous_logs.length > 40 ||
    !value.previous_logs.every((line) => isBoundedString(line, 2000)) ||
    !Array.isArray(value.events) ||
    value.events.length > 40 ||
    !value.events.every((event) => isBoundedString(event, 1000)) ||
    !Array.isArray(value.deploy_history) ||
    value.deploy_history.length > 10
  ) return null;

  const deployHistory: IncidentDeployment[] = [];
  for (const item of value.deploy_history) {
    if (
      !isRecord(item) ||
      typeof item.revision !== "number" ||
      !Number.isInteger(item.revision) ||
      item.revision < 1 ||
      !isBoundedString(item.version, 64) ||
      !isBoundedString(item.status, 64)
    ) return null;
    deployHistory.push({
      revision: item.revision,
      version: item.version,
      status: item.status,
    });
  }

  return {
    metrics_summary: value.metrics_summary,
    previous_logs: value.previous_logs as string[],
    events: value.events as string[],
    deploy_history: deployHistory,
  };
}

function parseIncidentAnalysis(value: unknown): IncidentAnalysis | null {
  if (!isRecord(value)) return null;
  const evidence = value.evidence_ar;
  if (
    !isBoundedString(value.root_cause_ar, 2000, 1) ||
    typeof value.confidence !== "number" ||
    !Number.isInteger(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 100 ||
    !Array.isArray(evidence) ||
    evidence.length > 12 ||
    !evidence.every((item) => isBoundedString(item, 500)) ||
    !isBoundedString(value.action_target, 200) ||
    !isBoundedString(value.explanation_ar, 2000)
  ) return null;

  const action: IncidentAction =
    typeof value.action === "string" && ALLOWED_ACTIONS.has(value.action as IncidentAction)
      ? (value.action as IncidentAction)
      : "none";

  return {
    root_cause_ar: value.root_cause_ar,
    confidence: value.confidence,
    evidence_ar: evidence as string[],
    action,
    action_target: value.action_target,
    explanation_ar: value.explanation_ar,
  };
}

router.post("/analyze", async (req, res): Promise<void> => {
  const evidence = parseIncidentEvidence(req.body);
  if (!evidence) {
    req.log.warn("Invalid incident evidence");
    res.status(400).json({ error: "Invalid incident evidence" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    req.log.error("OPENAI_API_KEY is not configured");
    res.status(503).json({ error: "AI analysis is not configured" });
    return;
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 15_000,
      maxRetries: 0,
    });
    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(evidence) },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      req.log.error("Groq returned no analysis content");
      res.status(502).json({ error: "AI analysis returned invalid data" });
      return;
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(content);
    } catch {
      req.log.error("Groq returned invalid JSON");
      res.status(502).json({ error: "AI analysis returned invalid data" });
      return;
    }

    const analysis = parseIncidentAnalysis(candidate);
    if (!analysis) {
      req.log.error("Groq response failed incident analysis validation");
      res.status(502).json({ error: "AI analysis returned invalid data" });
      return;
    }

    req.log.info({ action: analysis.action }, "Incident analysis completed");
    res.json(analysis);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = error instanceof Error ? error.message.slice(0, 400) : "Unknown error";
    const statusCode =
      isRecord(error) && typeof error.status === "number" ? error.status : undefined;
    const timedOut = /timeout/i.test(errorName);
    req.log.error(
      { errorName, errorMessage, statusCode, timedOut },
      "Groq analysis request failed",
    );
    res
      .status(timedOut ? 504 : 502)
      .json({ error: timedOut ? "AI analysis timed out" : "AI analysis failed" });
  }
});

export default router;