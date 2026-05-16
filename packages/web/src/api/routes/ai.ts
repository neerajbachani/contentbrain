const AI_BASE = process.env.AI_GATEWAY_BASE_URL ?? "https://api.openai.com/v1";
const AI_KEY = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

export async function callAI(prompt: string, temperature = 0.8): Promise<string> {
  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature,
    }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content ?? "";
}

export async function processInspiration(rawContent: string, url?: string) {
  const prompt = `Analyze this content and return valid JSON (no markdown, no code blocks) with exactly these keys:
{
  "summary": "one sentence summary",
  "tags": ["tag1", "tag2", "tag3"],
  "content_type": "tweet or thread or reel or blog or reddit or meme or other",
  "writing_style": "casual or educational or funny or motivational or controversial",
  "key_ideas": ["idea1", "idea2", "idea3"],
  "hook": "what makes this content work in one sentence"
}

Content: ${rawContent}
${url ? `URL: ${url}` : ""}`;

  const raw = await callAI(prompt, 0.5);
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: rawContent.slice(0, 100),
      tags: [],
      content_type: "other",
      writing_style: "casual",
      key_ideas: [],
      hook: "",
    };
  }
}

export async function remixContent(
  originalContent: string,
  outputType: string,
  targetPlatform: string,
  style: string
) {
  const prompt = `You are a viral content strategist. Take this inspiration and generate 3 unique content variations.

Original inspiration:
"${originalContent}"

Output format: ${outputType}
Target platform: ${targetPlatform}
Writing style: ${style}

Rules:
- DO NOT copy the original — reimagine it with a fresh angle
- Each variation must have a different hook/approach
- Keep platform best practices in mind
- Make it feel authentic, not AI-generated

Return valid JSON only (no markdown):
{
  "variations": [
    {
      "label": "The Direct Angle",
      "content": "...",
      "why_it_works": "one line explanation"
    },
    {
      "label": "The Contrarian Angle",
      "content": "...",
      "why_it_works": "one line explanation"
    },
    {
      "label": "The Story Angle",
      "content": "...",
      "why_it_works": "one line explanation"
    }
  ]
}`;

  const raw = await callAI(prompt, 0.9);
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { variations: [] };
  }
}

export async function mergeContent(
  sources: Array<{ sourcePlatform: string; rawContent: string; title?: string | null }>,
  outputType: string,
  userContext?: string
) {
  const sourcesText = sources
    .map((s, i) => `Source ${i + 1} (${s.sourcePlatform}): ${s.rawContent}`)
    .join("\n\n");

  const prompt = `You are a master content creator. I'm giving you ${sources.length} content pieces from different platforms.
Your job is to synthesize them into one powerful, original piece of content.

Sources:
${sourcesText}

Output type: ${outputType}
${userContext ? `Additional direction: ${userContext}` : ""}

Instructions:
- Find the common thread or tension between these sources
- Combine insights, angles, and ideas into something more powerful than each source alone
- This is "steal like an artist" — inspired by all, original in execution
- Optimize for ${outputType} format

Return the complete content ready to publish (plain text, no JSON wrapper needed).`;

  return await callAI(prompt, 0.9);
}
