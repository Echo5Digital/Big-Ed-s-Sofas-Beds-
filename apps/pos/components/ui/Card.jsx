export default function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-black/6 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] sm:p-5 ${className}`}>
      {children}
    </div>
  );
}
