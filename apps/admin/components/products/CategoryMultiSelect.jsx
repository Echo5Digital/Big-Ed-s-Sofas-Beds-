"use client";

// Groups flat Category rows (parent + children via parentId, see
// packages/database/prisma/schema.prisma) into sections for checkbox
// selection. The first checked category becomes the product's primary
// categoryId; any additional checked categories become secondary
// ProductCategory tags.
export default function CategoryMultiSelect({ categories, selectedIds, onChange }) {
  const roots = categories.filter((c) => !c.parentId);
  const childrenByParent = categories.reduce((acc, c) => {
    if (c.parentId) (acc[c.parentId] ??= []).push(c);
    return acc;
  }, {});

  function toggle(id) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-brand-charcoal/60">
        The first category checked is the product&rsquo;s primary category. Check any others to also
        list it on those category pages.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {roots.map((root) => (
          <div key={root.id} className="flex flex-col gap-1.5 rounded-lg border border-black/10 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-brand-charcoal">
              <input
                type="checkbox"
                checked={selectedIds.includes(root.id)}
                onChange={() => toggle(root.id)}
                className="size-4 rounded border-black/30 text-brand-red focus:ring-brand-red"
              />
              {root.name}
            </label>
            {(childrenByParent[root.id] ?? []).map((child) => (
              <label key={child.id} className="ml-6 flex items-center gap-2 text-sm text-brand-charcoal/80">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(child.id)}
                  onChange={() => toggle(child.id)}
                  className="size-4 rounded border-black/30 text-brand-red focus:ring-brand-red"
                />
                {child.name}
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
