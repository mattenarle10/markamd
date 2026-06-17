import { expect, test } from "bun:test";
import { renderMarkdown } from "../src/lib/markdown";
import { plantUmlUrl } from "../src/lib/plantuml";

test("builds plantuml server svg urls", () => {
  expect(plantUmlUrl("A -> B: Hello")).toBe(
    "https://www.plantuml.com/plantuml/svg/SrJGjLDmibBmICt9oGS0",
  );
});

test("renders plantuml fences as explicit preview blocks", async () => {
  const html = await renderMarkdown("```plantuml\nA -> B: Hello\n```", "latte");

  expect(html).toContain('class="mdv-plantuml"');
  expect(html).toContain("https://www.plantuml.com/plantuml/svg/");
  expect(html).toContain("A -&gt; B: Hello");
});
