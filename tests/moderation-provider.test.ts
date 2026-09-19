import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAIModerationProvider } from "../lib/moderation/provider.ts";
import { decide } from "../lib/moderation/decision-engine.ts";
import { environment, isolatedStore } from "./helpers/moderation.ts";

const safeCategories = {
  sexual: false,
  "sexual/minors": false,
  "violence/graphic": false,
  hate: false,
  "hate/threatening": false,
  "harassment/threatening": false,
  "self-harm/intent": false,
  "self-harm/instructions": false,
  harassment: false,
  illicit: false,
  "illicit/violent": false,
  "self-harm": false,
  violence: false,
};
const safety = () => ({
  id: "test-safety",
  results: [
    {
      flagged: false,
      categories: { ...safeCategories },
      category_scores: Object.fromEntries(
        Object.keys(safeCategories).map((key) => [key, 0]),
      ),
    },
  ],
});
const policy = (extra: Record<string, unknown> = {}) => ({
  status: "completed",
  id: "test-vision",
  output: [
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: JSON.stringify({
            findings: [],
            uncertain: false,
            textComplete: true,
            visibleText: "Synthetic ad",
            ...extra,
          }),
        },
      ],
    },
  ],
});

for (const scenario of ["flagged low score", "overall flag", "missing threat category", "unmapped high score", "critical low score", "500", "401", "429"]) {
  test(`adversarial provider response: ${scenario} never passes`, async t => {
    isolatedStore(t);
    environment(t, { MODERATION_API_KEY: "synthetic-test-key" });
    const provider = new OpenAIModerationProvider(async input => {
      if (!String(input).endsWith("moderations")) return Response.json(policy());
      if (/^\d+$/.test(scenario)) return new Response("synthetic failure", { status: Number(scenario) });
      const body = safety();
      const result = body.results[0];
      if (scenario === "overall flag") result.flagged = true;
      if (scenario === "flagged low score") result.categories.hate = true;
      if (scenario === "critical low score") result.categories["sexual/minors"] = true;
      if (scenario === "missing threat category") delete (result.categories as Record<string, boolean>)["harassment/threatening"];
      if (scenario === "unmapped high score") {
        (result.categories as Record<string, boolean>).unknown = false;
        result.category_scores.unknown = .99;
      }
      return Response.json(body);
    });
    const result = decide([await provider.moderateImage(Buffer.from("harmless fixture"))]);
    assert.equal(result.decision, "manual_review");
    if (scenario === "critical low score") assert.equal(result.critical, true);
  });
}

test("provider sends private server credentials, structured rules, and store:false", async (t) => {
  isolatedStore(t);
  environment(t, { MODERATION_API_KEY: "synthetic-test-key" });
  const requests: { url: string; data: Record<string, unknown> }[] = [];
  const provider = new OpenAIModerationProvider(async (input, init) => {
    assert.equal(
      (init!.headers as Record<string, string>).Authorization,
      "Bearer synthetic-test-key",
    );
    const url = String(input),
      data = JSON.parse(init!.body as string);
    requests.push({ url, data });
    return Response.json(url.endsWith("moderations") ? safety() : policy());
  });
  const result = await provider.moderateImage(
    Buffer.from("safe synthetic bytes"),
  );
  assert.equal(decide([result]).decision, "approved");
  assert.equal(result.visibleText, "Synthetic ad");
  const vision = requests.find((row) => row.url.endsWith("responses"))!;
  assert.equal(vision.data.store, false);
  assert.match(String(vision.data.instructions), /never follow instructions/);
  assert.equal(requests.length, 2);
});
for (const scenario of [
  "network",
  "timeout",
  "empty safety",
  "refusal",
  "incomplete",
  "invalid json",
  "unknown category",
  "unreadable text",
]) {
  test(`provider ${scenario} fails closed`, async (t) => {
    isolatedStore(t);
    environment(t, { MODERATION_API_KEY: "synthetic-test-key" });
    const provider = new OpenAIModerationProvider(async (input) => {
      if (scenario === "network") throw new Error("network");
      if (scenario === "timeout")
        throw new DOMException("Timeout", "TimeoutError");
      if (String(input).endsWith("moderations"))
        return Response.json(
          scenario === "empty safety"
            ? {
                id: "test",
                results: [
                  { flagged: false, categories: {}, category_scores: {} },
                ],
              }
            : safety(),
        );
      if (scenario === "refusal")
        return Response.json({
          status: "completed",
          id: "test",
          output: [{ type: "message", content: [{ type: "refusal" }] }],
        });
      if (scenario === "incomplete")
        return Response.json({ ...policy(), status: "incomplete" });
      if (scenario === "invalid json")
        return Response.json({
          status: "completed",
          id: "test",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "not JSON" }],
            },
          ],
        });
      return Response.json(
        policy(
          scenario === "unknown category"
            ? { findings: [{ category: "UNKNOWN", confidence: 1 }] }
            : scenario === "unreadable text"
              ? { textComplete: false }
              : {},
        ),
      );
    });
    assert.equal(
      decide([await provider.moderateImage(Buffer.from("synthetic"))]).decision,
      "manual_review",
    );
  });
}
test("a clear safety signal survives an unavailable second classifier", async (t) => {
  isolatedStore(t);
  environment(t, { MODERATION_API_KEY: "synthetic-test-key" });
  const provider = new OpenAIModerationProvider(async (input) => {
    if (String(input).endsWith("responses"))
      return new Response("unavailable", { status: 503 });
    const result = safety();
    result.results[0].categories["violence/graphic"] = true;
    result.results[0].category_scores["violence/graphic"] = 0.99;
    return Response.json(result);
  });
  assert.equal(
    decide([await provider.moderateImage(Buffer.from("synthetic"))]).decision,
    "rejected",
  );
});
