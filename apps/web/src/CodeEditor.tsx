import { Editor, loader } from "@monaco-editor/react";
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
export default Editor;
