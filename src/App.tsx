import { KaleidoscopeCanvas } from "./features/kaleidoscope/KaleidoscopeCanvas";
import { midnightBloom } from "./features/kaleidoscope/kaleidoscopePresets";

export function App() {
  return (
    <main className="app-shell">
      <KaleidoscopeCanvas parameters={midnightBloom} />
      <div className="atmosphere" aria-hidden="true" />
    </main>
  );
}
