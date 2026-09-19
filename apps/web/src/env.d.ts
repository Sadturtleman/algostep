declare module "*?worker" {
  const WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}
interface Window {
  AlgostepNative?: {
    postMessage(message: string): void;
    onmessage?: (event: { data: string }) => void;
  };
  google?: any;
  MonacoEnvironment?: any;
}
