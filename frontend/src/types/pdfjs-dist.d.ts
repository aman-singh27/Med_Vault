declare module "pdfjs-dist" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
  export function getDocument(params: any): { promise: any };
}
