export default function ChatLoadingSkeleton() {
  return (
    <div role="status" aria-label="Chargement des messages" className="space-y-3 py-3">
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} aria-hidden="true" className={`flex ${row % 2 ? 'justify-end' : 'justify-start'}`}>
          <div className={`h-12 max-w-[75%] rounded-2xl bg-[var(--loboko-elevated)] motion-safe:animate-pulse ${row % 2 ? 'w-44' : 'w-52'}`} />
        </div>
      ))}
    </div>
  );
}
