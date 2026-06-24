import { Activity } from "lucide-react";

export function LoadingScreen() {
  return (
    <main className="loading-screen">
      <Activity size={24} />
      <span>Loading Sector Radar</span>
    </main>
  );
}
