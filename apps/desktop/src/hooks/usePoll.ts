import { useEffect } from "react";

export function usePoll(load: () => Promise<void>) {
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        if (active) await load();
      } finally {
        if (active) timer = setTimeout(() => void run(), 1500);
      }
    };
    void run();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);
}
