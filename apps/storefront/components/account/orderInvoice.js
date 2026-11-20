import { formatCurrency } from "@/utils/formatCurrency";
import { siteConfig } from "@/lib/mock-data/site-config";

// Builds a standalone, print-ready HTML document for a completed order —
// opened in a new tab and sent straight to window.print() (see
// OrdersSection.jsx's downloadInvoice). The customer's browser "Save as
// PDF" print destination is the actual download; this repo has no
// PDF-generation dependency and doesn't need one for a one-page invoice
// like this. Plain inline styles only (no Tailwind) since this HTML is
// never processed by this app's own build — it's written directly into a
// fresh document via document.write.

const money = (cents) => formatCurrency(cents / 100);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function buildInvoiceHtml(order) {
  const address = order.shippingAddress;
  const rows = order.lines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.name)}</td>
          <td class="num">${line.quantity}</td>
          <td class="num">${money(line.unitPriceCents)}</td>
          <td class="num">${money(line.lineTotalCents)}</td>
        </tr>`
    )
    .join("");

  const totalsRows = [
    ["Subtotal", money(order.subtotalCents)],
    order.discountCents > 0 ? ["Discount", `−${money(order.discountCents)}`] : null,
    order.deliveryFeeCents > 0 ? ["Delivery", money(order.deliveryFeeCents)] : null,
    order.taxCents > 0 ? ["Tax", money(order.taxCents)] : null,
  ]
    .filter(Boolean)
    .map(([label, value]) => `<tr><td colspan="3" class="label">${label}</td><td class="num">${value}</td></tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice — Order ${escapeHtml(order.orderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1f2430; margin: 0; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f2430; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: bold; }
  .brand-sub { font-size: 12px; color: #555; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { margin: 0; font-size: 20px; }
  .invoice-title p { margin: 2px 0; font-size: 13px; color: #555; }
  .meta { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 24px; font-size: 13px; }
  .meta h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th { text-align: left; border-bottom: 1px solid #ccc; padding: 8px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #888; }
  td { padding: 8px 4px; border-bottom: 1px solid #eee; }
  .num { text-align: right; }
  .label { text-align: right; color: #555; }
  tfoot td { border-bottom: none; }
  .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid #1f2430; padding-top: 10px; }
  .footer { margin-top: 32px; font-size: 12px; color: #888; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(siteConfig.brandName)} ${escapeHtml(siteConfig.brandSubtitle)}</div>
      <div class="brand-sub">${escapeHtml(siteConfig.address.line1)}, ${escapeHtml(siteConfig.address.line2)}</div>
      <div class="brand-sub">${escapeHtml(siteConfig.phone)}</div>
    </div>
    <div class="invoice-title">
      <h1>Invoice</h1>
      <p>Order ${escapeHtml(order.orderNumber)}</p>
      <p>${formatDate(order.placedAt)}</p>
    </div>
  </div>

  <div class="meta">
    ${
      address
        ? `<div>
      <h3>Shipping Address</h3>
      <p>${escapeHtml(address.line1)}${address.line2 ? `, ${escapeHtml(address.line2)}` : ""}<br/>
      ${escapeHtml(address.city)}, ${escapeHtml(address.state)} ${escapeHtml(address.postalCode)}</p>
    </div>`
        : "<div></div>"
    }
    <div>
      <h3>Status</h3>
      <p>${escapeHtml(order.displayStatus)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      ${totalsRows}
      <tr class="total-row"><td colspan="3" class="label">Total</td><td class="num">${money(order.totalCents)}</td></tr>
    </tfoot>
  </table>

  <div class="footer">Thank you for shopping with ${escapeHtml(siteConfig.brandName)} ${escapeHtml(siteConfig.brandSubtitle)}.</div>
</body>
</html>`;
}
