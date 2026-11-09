import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

/** Source-distributed beUI's MIT notice must travel with both bundled frontends. */
export function beuiLicense(): Plugin {
  return {
    name: "beui-license",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "beui-LICENSE.txt",
        source: readFileSync(new URL("../apps/desktop/src/components/beui/LICENSE", import.meta.url), "utf8"),
      });
    },
  };
}
