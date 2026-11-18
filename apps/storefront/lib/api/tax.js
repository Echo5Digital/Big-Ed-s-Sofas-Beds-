// Grosses up a tax-exclusive price in cents by a variant's own flat
// taxRatePercent (e.g. 8.25), rounding the same way the server does when it
// computes OrderLine.taxCents — so the price shown here matches what
// checkout/POS actually charges once tax is added. Returns a dollar amount
// (not cents) since every storefront price display works in dollars.
export function priceWithTax(priceCents, taxRatePercent) {
  const taxCents = Math.round((priceCents * Number(taxRatePercent ?? 0)) / 100);
  return (priceCents + taxCents) / 100;
}
