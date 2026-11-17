// Prisma's `contains`/`startsWith`/`endsWith` compile to a raw SQL
// LIKE/ILIKE under the hood — `%` and `_` in the search text are wildcard
// metacharacters there, not literal characters, and Prisma does not escape
// them. Without this, a product name/SKU/order number containing a literal
// "%" or "_" (or a customer pasting one in) silently changes what matches
// instead of being searched for as typed. `\` is escaped first so the
// escape character itself can't be smuggled in to defeat the other two.
function escapeLikeWildcards(value) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

module.exports = { escapeLikeWildcards };
