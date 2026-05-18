import { callAI } from "../../routes/ai";
import type { ContextComment, ContextPost } from "./redditContext";

const REACTION_ARCHETYPES = [
  "The Contrarian (pushes back with a counter-argument)",
  "The Agreeable (validates the core idea with their own experience)",
  "The Questioner (asks the most obvious follow-up question the audience has)",
  "The Story (shares a personal anecdote that illustrates the point)",
  "The Data Point (adds a stat, study, or proof that reinforces or challenges the idea)",
];

export async function fetchAIContext(
  rawContent: string,
  keyIdeas: string[],
  tags: string[],
  mode: "x" | "generic"
): Promise<{ comments: ContextComment[]; relatedPosts: ContextPost[] }> {
  const ideasText = keyIdeas.length > 0 ? keyIdeas.join(", ") : "none";
  const tagsText = tags.length > 0 ? tags.join(", ") : "none";

  const archetypesText = REACTION_ARCHETYPES.map((a, i) => `${i + 1}. ${a}`).join("\n");

  const prompt = mode === "x"
    ? `You are analyzing a post from X (Twitter). Generate 5 realistic community reactions.

Post content:
"${rawContent}"

Key ideas: ${ideasText}
Tags: ${tagsText}

For each of these reaction archetypes, write a short realistic comment (50-120 words) that someone might post in reply:
${archetypesText}

Return valid JSON only (no markdown):
{
  "reactions": [
    { "archetype": "The Contrarian", "body": "...", "engagementHint": "High engagement" },
    { "archetype": "The Agreeable", "body": "...", "engagementHint": "Relatable" },
    { "archetype": "The Questioner", "body": "...", "engagementHint": "Common doubt" },
    { "archetype": "The Story", "body": "...", "engagementHint": "Personal connection" },
    { "archetype": "The Data Point", "body": "...", "engagementHint": "Credibility booster" }
  ]
}`
    : `You are a content research assistant. Given this content, generate 4-5 related content angles that creators are talking about on the same topic.

Content:
"${rawContent}"

Key ideas: ${ideasText}
Tags: ${tagsText}

Generate angles that are:
- Distinct from each other
- Based on real discourse patterns around these ideas
- Useful as inspiration for creating new content

Return valid JSON only (no markdown):
{
  "angles": [
    { "title": "...", "summary": "...", "angle": "Contrarian take / Supporting evidence / Adjacent idea / etc." }
  ]
}`;

  const raw = await callAI(prompt, 0.8);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (mode === "x") {
      const reactions = parsed.reactions ?? [];
      const comments: ContextComment[] = reactions.map((r: any) => ({
        author: r.archetype,
        body: r.body,
        score: 0,
        sourceUrl: undefined,
      }));
      return { comments, relatedPosts: [] };
    } else {
      const angles = parsed.angles ?? [];
      const relatedPosts: ContextPost[] = angles.map((a: any) => ({
        title: a.title,
        url: "",
        score: 0,
        platform: "ai",
        summary: a.summary,
      }));
      return { comments: [], relatedPosts };
    }
  } catch {
    return { comments: [], relatedPosts: [] };
  }
}
