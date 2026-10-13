"use client";

import { useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { abbreviationTracker, EmmetKnownSyntax } from "@emmetio/codemirror6-plugin";
import { FileCode2, FileJson, Hash, ImageIcon, Maximize2, Minimize2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AdFiles } from "../ad-files";
import { AdAssetsPanel } from "./ad-assets-panel";

type FileKey = keyof AdFiles;
type TabKey = FileKey | "assets";

const IMAGE_URL = /https?:\/\/[^\s"'()<>]+\.(?:png|jpe?g|webp|avif|gif)(?=[\s"'()<>?#]|$)/gi;

const FILES: { key: FileKey; name: string; icon: typeof FileCode2; parser: "html" | "css" | "babel" }[] = [
  { key: "html", name: "index.html", icon: FileCode2, parser: "html" },
  { key: "css", name: "style.css", icon: Hash, parser: "css" },
  { key: "js", name: "script.js", icon: FileJson, parser: "babel" },
];

const PLACEHOLDERS: Record<FileKey, string> = {
  html: "<div>…</div>",
  css: "/* styles */",
  js: "// script",
};

async function formatSource(source: string, parser: "html" | "css" | "babel") {
  const [prettier, plugins] = await Promise.all([
    import("prettier/standalone"),
    Promise.all([import("prettier/plugins/html"), import("prettier/plugins/postcss"), import("prettier/plugins/babel"), import("prettier/plugins/estree")]),
  ]);
  return prettier.format(source, { parser, plugins: plugins.map((plugin) => plugin.default ?? plugin), printWidth: 100 });
}

interface AdCodeEditorProps {
  files: AdFiles;
  onChange: (files: AdFiles) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function AdCodeEditor({ files, onChange, fullscreen, onToggleFullscreen }: AdCodeEditorProps) {
  const [active, setActive] = useState<TabKey>("html");
  const [formatting, setFormatting] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const cursors = useRef<Partial<Record<FileKey, number>>>({});

  const assets = useMemo(() => {
    const found = Object.values(files).flatMap((source) => source.match(IMAGE_URL) ?? []);
    return [...new Set([...uploaded, ...found])];
  }, [files, uploaded]);

  const insertImage = (url: string) => {
    const html = files.html;
    const at = Math.min(cursors.current.html ?? html.length, html.length);
    onChange({ ...files, html: `${html.slice(0, at)}<img src="${url}" alt="">${html.slice(at)}` });
    setActive("html");
    toast.success("Inserted into index.html");
  };

  const extensions = useMemo(() => {
    const base = [EditorView.lineWrapping, keymap.of([indentWithTab])];
    if (active === "assets") return [];
    if (active === "html") return [html({ autoCloseTags: true, matchClosingTags: true }), abbreviationTracker(), ...base];
    if (active === "css") return [css(), abbreviationTracker({ syntax: EmmetKnownSyntax.css }), ...base];
    return [javascript(), ...base];
  }, [active]);

  const format = async () => {
    if (active === "assets") return;
    const file = FILES.find((entry) => entry.key === active)!;
    setFormatting(true);
    try {
      onChange({ ...files, [active]: await formatSource(files[active], file.parser) });
    } catch {
      toast.error(`Could not format ${file.name}: fix the syntax error first`);
    } finally {
      setFormatting(false);
    }
  };

  const FullscreenIcon = fullscreen ? Minimize2 : Maximize2;

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-neutral-800 focus-within:ring-2 focus-within:ring-ring", fullscreen && "h-full")}>
      <div className="flex items-center gap-1 border-b border-neutral-800 bg-neutral-950 pr-2">
        <div role="tablist" className="flex min-w-0 flex-1 overflow-x-auto">
          {FILES.map(({ key, name, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              onClick={() => setActive(key)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-t-2 px-4 py-2 text-xs transition-colors",
                active === key
                  ? "border-sky-400 bg-neutral-900 text-neutral-100"
                  : "border-transparent text-neutral-500 hover:text-neutral-300",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {name}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={active === "assets"}
            onClick={() => setActive("assets")}
            className={cn(
              "flex shrink-0 items-center gap-2 border-t-2 px-4 py-2 text-xs transition-colors",
              active === "assets"
                ? "border-sky-400 bg-neutral-900 text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-300",
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Assets
          </button>
        </div>
        <button
          type="button"
          onClick={format}
          disabled={formatting || active === "assets"}
          title="Format with Prettier"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-50"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Format
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <FullscreenIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      {active === "assets" ? (
        <div className={cn("min-h-0 overflow-auto", fullscreen ? "flex-1" : "h-96")}>
          <AdAssetsPanel
            assets={assets}
            onUploaded={(url) => setUploaded((current) => [url, ...current])}
            onInsert={insertImage}
          />
        </div>
      ) : (
        <CodeMirror
          key={active}
          value={files[active]}
          onChange={(value, update) => {
            cursors.current[active] = update.state.selection.main.head;
            onChange({ ...files, [active]: value });
          }}
          onUpdate={(update) => {
            if (update.selectionSet) cursors.current[active] = update.state.selection.main.head;
          }}
          theme={vscodeDark}
          extensions={extensions}
          placeholder={PLACEHOLDERS[active]}
          height={fullscreen ? "100%" : "24rem"}
          className={cn("min-h-0 text-xs", fullscreen && "flex-1 [&>.cm-editor]:h-full")}
          basicSetup={{ foldGutter: true, highlightActiveLine: true, autocompletion: true }}
        />
      )}
    </div>
  );
}
