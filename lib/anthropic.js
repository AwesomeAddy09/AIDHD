import Anthropic from "@anthropic-ai/sdk";

let client = null;
function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

export async function callClaude(system, userText, maxTokens = 1000) {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userText }],
  });
  return (msg.content || [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");
}

export function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}
