/// <reference types="vite/client" />
declare module "*.png" { const url: string; export default url; }
declare module "*.txt?raw" { const content: string; export default content; }
