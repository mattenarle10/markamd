export const DEMO_MARKDOWN = `# welcome to marka.md

![](/mascot/write.png)

a local markdown editor for the notes you share with ai.
edit on the left. preview on the right. press **⌘.** for reading mode.

---

## diagrams

mermaid renders live:

\`\`\`mermaid
flowchart LR
  Idea --> Draft
  Draft --> Share
  Share --> Claude
  Claude --> Idea
\`\`\`

plantuml can be previewed on demand:

\`\`\`plantuml
Alice -> Bob: hello
Bob --> Alice: saved
\`\`\`

---

## code

shiki highlights every code block — colors follow the active theme:

\`\`\`ts
function copyContext(files: string[]): string {
  return files
    .map((f) => \`<context file="\${f}">\\n...\\n</context>\`)
    .join("\\n\\n");
}
\`\`\`

---

![](/mascot/excite.png)

ready when you are. **⌘N** for a fresh buffer, **⌘⇧O** to open a folder.

_marka.md · open source · MIT_
`;
