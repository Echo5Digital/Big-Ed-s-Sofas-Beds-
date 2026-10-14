export function formatCents(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
