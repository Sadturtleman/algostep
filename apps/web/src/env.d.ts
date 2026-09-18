declare module "*?worker" {
  const WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}
interface Window {
  google?: any;
  MonacoEnvironment?: any;
}
