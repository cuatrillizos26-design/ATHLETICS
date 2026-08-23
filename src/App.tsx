import { useEffect, useRef } from "react";
import { initGame } from "./game/core";

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) return initGame(ref.current);
  }, []);
  return <div ref={ref} className="game-root" />;
}
