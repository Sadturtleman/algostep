import { Editor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
window.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export default Editor;
