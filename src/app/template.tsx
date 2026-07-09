/**
 * Re-mounts on every navigation, giving each page a quiet entrance.
 * Pure CSS — no client boundary needed.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col animate-page">{children}</div>;
}
