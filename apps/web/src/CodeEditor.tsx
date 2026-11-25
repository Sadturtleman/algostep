import { useLayoutEffect, useState } from "react";
import { Editor, loader, type EditorProps } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/cpp/register.js";
import "monaco-editor/languages/definitions/java/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
window.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
monaco.editor.defineTheme("algostep-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#f6f7fb",
    "editor.foreground": "#18213a",
    "editor.lineHighlightBackground": "#eaf0ff",
    "editorLineNumber.foreground": "#63708a",
  },
});
monaco.editor.defineTheme("algostep-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#222d43",
    "editor.foreground": "#edf1fa",
    "editor.lineHighlightBackground": "#22365f",
    "editorLineNumber.foreground": "#a8b5cf",
  },
});
export default function CodeEditor({
  executionLine,
  ...props
}: Omit<EditorProps, "onMount"> & { executionLine: number | null }) {
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>();
  useLayoutEffect(() => {
    const model = editor?.getModel();
    if (
      !editor ||
      !model ||
      executionLine === null ||
      executionLine > model.getLineCount()
    )
      return;
    const mark = editor.createDecorationsCollection([
      {
        range: new monaco.Range(executionLine, 1, executionLine, 1),
        options: {
          isWholeLine: true,
          className: "trace-execution-line",
        },
      },
    ]);
    editor.revealLineInCenterIfOutsideViewport(
      executionLine,
      monaco.editor.ScrollType.Immediate,
    );
    return () => mark.clear();
  }, [editor, executionLine]);
  return <Editor {...props} onMount={(instance) => setEditor(instance)} />;
}
