"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { marked } from "marked";
import { Button } from "./ui/button";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Table as TableIcon,
  Code,
  Eye,
  Columns3,
  Rows3,
  Trash2,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Heuristic: is this raw markdown, or HTML we (or a previous save) already produced?
 * Content coming back from the editor is always HTML, so we must not re-parse it —
 * doing so would fight the sync effect below and clobber the caret on every keystroke.
 */
function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  // Stored/editor HTML always opens with a block-level tag.
  if (/^<(p|h[1-6]|ul|ol|table|blockquote|div|figure|img|pre)\b/i.test(t)) {
    return false;
  }

  return (
    /^\s{0,3}#{1,6}\s/m.test(t) || // ## heading
    /^\s{0,3}\|.*\|\s*$/m.test(t) || // | table | row |
    /^\s{0,3}[-*+]\s+/m.test(t) || // - bullet
    /^\s{0,3}>\s/m.test(t) || // > quote
    /\[[^\]]+\]\([^)]+\)/.test(t) || // [link](url)
    /\*\*[^*]+\*\*/.test(t) // **bold**
  );
}

/**
 * Converts a full markdown document (GFM tables included) into HTML that Tiptap's
 * schema can parse. Emits plain semantic tags — table styling lives in globals.css
 * under `.prose table`, and Tiptap strips undeclared attributes anyway.
 *
 * HTML input is passed through untouched.
 */
export function convertMarkdownToHtml(text: string): string {
  if (!text) return "";
  if (!looksLikeMarkdown(text)) return text;

  return marked.parse(text, { gfm: true, breaks: false, async: false }) as string;
}

const MenuBar = ({
  editor,
  isCodeMode,
  setIsCodeMode,
  insertTable,
}: {
  editor: Editor | null;
  isCodeMode: boolean;
  setIsCodeMode: (val: boolean) => void;
  insertTable: () => void;
}) => {
  if (!editor && !isCodeMode) {
    return null;
  }

  const inTable = !isCodeMode && editor?.isActive("table");

  return (
    <div className="flex flex-wrap items-center justify-between gap-1 border border-b-0 p-2 rounded-t-md bg-muted/50">
      <div className="flex flex-wrap items-center gap-1">
        {!isCodeMode && editor && (
          <>
            <Button
              type="button"
              variant={editor.isActive("bold") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive("italic") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive("strike") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            <Button
              type="button"
              variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            <Button
              type="button"
              variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive("blockquote") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </Button>
          </>
        )}

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs gap-1 font-semibold text-indigo-600 dark:text-indigo-400"
          onClick={insertTable}
          title="Insert Table"
        >
          <TableIcon className="h-4 w-4" />
          <span>Insert Table</span>
        </Button>

        {inTable && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1"
              onClick={() => editor!.chain().focus().addColumnAfter().run()}
              title="Add column"
            >
              <Columns3 className="h-4 w-4" />
              <span>+ Col</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1"
              onClick={() => editor!.chain().focus().addRowAfter().run()}
              title="Add row"
            >
              <Rows3 className="h-4 w-4" />
              <span>+ Row</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1 text-destructive"
              onClick={() => editor!.chain().focus().deleteTable().run()}
              title="Delete table"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <Button
        type="button"
        variant={isCodeMode ? "secondary" : "outline"}
        size="sm"
        className="h-8 px-2.5 text-xs gap-1.5 font-medium ml-auto"
        onClick={() => setIsCodeMode(!isCodeMode)}
      >
        {isCodeMode ? (
          <>
            <Eye className="h-3.5 w-3.5" />
            <span>Visual Mode</span>
          </>
        ) : (
          <>
            <Code className="h-3.5 w-3.5" />
            <span>Code Mode</span>
          </>
        )}
      </Button>
    </div>
  );
};

export function TiptapEditor({ value, onChange }: TiptapEditorProps) {
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [codeValue, setCodeValue] = useState(value || "");

  // Tracks the HTML we last handed to onChange, so the sync effect can tell an
  // external update apart from our own value echoing back through the parent.
  const lastEmittedRef = useRef<string | null>(null);

  const emit = (html: string) => {
    lastEmittedRef.current = html;
    onChange(html);
  };

  const editor = useEditor({
    extensions: [StarterKit, TableKit.configure({ table: { resizable: true } })],
    content: convertMarkdownToHtml(value || ""),
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setCodeValue(html);
      emit(html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[300px] border rounded-b-md p-4 bg-background",
      },
    },
  });

  // Sync content when the value changes from outside (e.g. initial load in edit mode).
  useEffect(() => {
    if (!editor || value === undefined) return;

    // Our own output coming back around — already rendered, nothing to do.
    if (value === lastEmittedRef.current) return;

    const parsed = convertMarkdownToHtml(value);
    setCodeValue(value);
    if (editor.getHTML() !== parsed) {
      editor.commands.setContent(parsed);
    }
  }, [value, editor]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setCodeValue(newVal);
    const parsed = convertMarkdownToHtml(newVal);
    emit(parsed);
    if (editor) {
      editor.commands.setContent(parsed);
    }
  };

  const insertTable = () => {
    if (isCodeMode) {
      const snippet = `

| Header 1 | Header 2 | Header 3 |
|---|---|---|
| Item 1 | ৳১,৫০০ | বিবরণ ১ |
| Item 2 | ৳৩,১৯০ | বিবরণ ২ |

`;
      const updated = codeValue + snippet;
      setCodeValue(updated);
      const parsed = convertMarkdownToHtml(updated);
      emit(parsed);
      if (editor) editor.commands.setContent(parsed);
    } else if (editor) {
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    }
  };

  return (
    <div className="flex flex-col w-full">
      <MenuBar
        editor={editor}
        isCodeMode={isCodeMode}
        setIsCodeMode={setIsCodeMode}
        insertTable={insertTable}
      />
      {isCodeMode ? (
        <textarea
          value={codeValue}
          onChange={handleCodeChange}
          className="w-full min-h-[300px] border rounded-b-md p-4 font-mono text-xs sm:text-sm bg-slate-950 text-slate-100 focus:outline-none leading-relaxed"
          placeholder="Paste or type Markdown / raw HTML content..."
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
