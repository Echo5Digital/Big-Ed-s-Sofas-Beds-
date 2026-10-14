export default function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-black/10 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {children}
    </div>
  );
}
