import { Editor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution.js";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js";
import "monaco-editor/esm/vs/basic-languages/java/java.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
window.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export default Editor;
