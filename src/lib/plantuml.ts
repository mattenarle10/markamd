import { encode } from "plantuml-encoder";

const PLANTUML_SVG_BASE = "https://www.plantuml.com/plantuml/svg";

export function plantUmlUrl(source: string): string {
  return `${PLANTUML_SVG_BASE}/${encode(source)}`;
}

export function decoratePlantUmlBlocks(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(".mdv-plantuml:not([data-mdv-plantuml-ready])"),
  );

  blocks.forEach((block) => {
    const url = block.dataset.src;
    if (!url) return;
    block.dataset.mdvPlantumlReady = "true";

    const actions = document.createElement("div");
    actions.className = "mdv-plantuml__actions";

    const load = document.createElement("button");
    load.type = "button";
    load.className = "mdv-plantuml__btn";
    load.textContent = "load preview";

    const note = document.createElement("span");
    note.className = "mdv-plantuml__note";
    note.textContent = "uses plantuml.com";

    actions.append(load, note);
    block.prepend(actions);

    const onLoad = () => {
      if (block.querySelector("img")) return;
      const img = document.createElement("img");
      img.className = "mdv-plantuml__img";
      img.alt = "PlantUML diagram";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = url;
      block.appendChild(img);
      load.textContent = "reload preview";
    };

    load.addEventListener("click", onLoad);
    cleanups.push(() => {
      load.removeEventListener("click", onLoad);
      actions.remove();
      delete block.dataset.mdvPlantumlReady;
    });
  });

  return () => cleanups.forEach((fn) => fn());
}
