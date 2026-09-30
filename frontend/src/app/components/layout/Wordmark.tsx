export function Wordmark({ className = "size-7" }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="PurvaDrishti"
      className={className}
      draggable={false}
    />
  );
}
