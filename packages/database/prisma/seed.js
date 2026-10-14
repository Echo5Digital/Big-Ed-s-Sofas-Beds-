const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../generated/client");

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: "catalog:read", description: "View products and categories" },
  { key: "catalog:write", description: "Create/edit products and categories" },
  { key: "inventory:read", description: "View stock levels and movements" },
  { key: "inventory:adjust", description: "Adjust stock, transfer, count" },
  { key: "purchasing:read", description: "View suppliers and purchase orders" },
  { key: "purchasing:write", description: "Create/edit purchase orders" },
  { key: "purchasing:approve", description: "Approve purchase orders" },
  { key: "purchasing:receive", description: "Receive goods against a PO" },
  { key: "orders:read", description: "View customer orders" },
  { key: "orders:write", description: "Edit/cancel customer orders" },
  { key: "users:manage", description: "Manage staff users and roles" },
  { key: "reports:read", description: "View reports" },
  { key: "pos:register:open", description: "Open a POS register session" },
  { key: "pos:register:close", description: "Close out a POS register session" },
  { key: "pos:sell", description: "Ring up POS sales (cash, deposit, card)" },
  { key: "pos:refund", description: "Process POS returns/refunds" },
];

const ROLE_PERMISSIONS = {
  ADMIN: PERMISSIONS.map((p) => p.key),
  MANAGER: [
    "catalog:read",
    "catalog:write",
    "inventory:read",
    "inventory:adjust",
    "purchasing:read",
    "purchasing:write",
    "purchasing:approve",
    "purchasing:receive",
    "orders:read",
    "orders:write",
    "reports:read",
  ],
  STAFF: [
    "catalog:read",
    "inventory:read",
    "purchasing:read",
    "purchasing:receive",
    "orders:read",
  ],
  CASHIER: [
    "catalog:read",
    "inventory:read",
    "orders:read",
    "pos:register:open",
    "pos:register:close",
    "pos:sell",
    "pos:refund",
  ],
};

async function main() {
  console.log("Seeding permissions + roles...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });
  }

  const roles = {};
  for (const roleName of ["ADMIN", "MANAGER", "STAFF", "CASHIER"]) {
    roles[roleName] = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role` },
    });

    for (const permKey of ROLE_PERMISSIONS[roleName]) {
      const permission = await prisma.permission.findUnique({ where: { key: permKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roles[roleName].id, permissionId: permission.id } },
        update: {},
        create: { roleId: roles[roleName].id, permissionId: permission.id },
      });
    }
  }

  console.log("Seeding default admin user...");
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@bigedsfurniture.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstName: "Big",
      lastName: "Ed",
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: roles.ADMIN.id } },
    update: {},
    create: { userId: adminUser.id, roleId: roles.ADMIN.id },
  });

  console.log(`Admin user ready: ${adminEmail} / ${adminPassword} (CHANGE THIS IMMEDIATELY)`);

  console.log("Seeding default cashier user...");
  const cashierEmail = process.env.SEED_CASHIER_EMAIL || "cashier@bigedsfurniture.com";
  const cashierPassword = process.env.SEED_CASHIER_PASSWORD || "ChangeMe123!";
  const cashierPasswordHash = await bcrypt.hash(cashierPassword, 12);

  const cashierUser = await prisma.user.upsert({
    where: { email: cashierEmail },
    update: {},
    create: {
      email: cashierEmail,
      passwordHash: cashierPasswordHash,
      firstName: "Showroom",
      lastName: "Cashier",
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: cashierUser.id, roleId: roles.CASHIER.id } },
    update: {},
    create: { userId: cashierUser.id, roleId: roles.CASHIER.id },
  });

  console.log(`Cashier user ready: ${cashierEmail} / ${cashierPassword} (CHANGE THIS IMMEDIATELY)`);

  console.log("Seeding locations...");
  const showroom = await prisma.location.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Showroom",
      type: "SHOWROOM",
    },
  });
  const warehouse = await prisma.location.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Warehouse",
      type: "WAREHOUSE",
    },
  });

  console.log("Seeding POS register...");
  const existingRegister = await prisma.register.findFirst({ where: { name: "Register 01" } });
  if (!existingRegister) {
    await prisma.register.create({
      data: { name: "Register 01", locationId: showroom.id, isActive: true },
    });
  }

  console.log("Seeding categories...");
  const categoryDefs = [
    { name: "Living Room", slug: "living-room", image: "/images/categories/living-room.jpg" },
    { name: "Bedroom", slug: "bedroom", image: "/images/categories/bedroom.jpg" },
    { name: "Mattresses", slug: "mattresses", image: "/images/categories/mattresses.jpg" },
    { name: "Dining", slug: "dining", image: "/images/categories/dining.jpg" },
    { name: "Sofas", slug: "sofas", image: "/images/categories/sofas.jpg" },
    { name: "Sectionals", slug: "sectionals", image: "/images/categories/sectionals.jpg" },
    { name: "Recliners", slug: "recliners", image: "/images/categories/recliners.jpg" },
    { name: "Beds", slug: "beds", image: "/images/categories/beds.jpg" },
  ];
  const categories = {};
  for (const def of categoryDefs) {
    categories[def.slug] = await prisma.category.upsert({
      where: { slug: def.slug },
      update: {},
      create: def,
    });
  }

  console.log("Seeding suppliers...");
  const supplierDefs = [
    { name: "Comfort Distribution", contactName: "Lena Ford", email: "orders@comfortdist.example.com", leadTimeDays: 14 },
    { name: "Apex Furniture Co.", contactName: "Marcus Diaz", email: "sales@apexfurniture.example.com", leadTimeDays: 21 },
    { name: "RestWell Wholesale", contactName: "Priya Nair", email: "purchasing@restwell.example.com", leadTimeDays: 10 },
  ];
  const suppliers = [];
  for (const def of supplierDefs) {
    const existing = await prisma.supplier.findFirst({ where: { name: def.name } });
    suppliers.push(existing || (await prisma.supplier.create({ data: def })));
  }

  console.log("Seeding products + variants...");
  const productDefs = [
    {
      name: "Cloud Comfort Sectional",
      slug: "cloud-comfort-sectional",
      categorySlug: "sectionals",
      brand: "Big Ed's Select",
      description: "Deep-seat sectional with reversible chaise and performance fabric.",
      variants: [
        { sku: "SEC-CLOUD-GRY", name: "Gray", color: "Gray", priceCents: 89900, costCents: 42000, onHandShowroom: 2, onHandWarehouse: 6 },
        { sku: "SEC-CLOUD-CHR", name: "Charcoal", color: "Charcoal", priceCents: 89900, costCents: 42000, onHandShowroom: 1, onHandWarehouse: 4 },
      ],
    },
    {
      name: "Power Recliner",
      slug: "power-recliner",
      categorySlug: "recliners",
      brand: "Big Ed's Select",
      description: "Power recline with USB charging and padded headrest.",
      variants: [
        { sku: "REC-POWER-BLK", name: "Black", color: "Black", priceCents: 39900, costCents: 18000, onHandShowroom: 2, onHandWarehouse: 5 },
        { sku: "REC-POWER-BRN", name: "Brown", color: "Brown", priceCents: 39900, costCents: 18000, onHandShowroom: 1, onHandWarehouse: 3 },
      ],
    },
    {
      name: "Platform Bed Frame",
      slug: "platform-bed-frame",
      categorySlug: "beds",
      brand: "Big Ed's Select",
      description: "Low-profile platform frame, no box spring required.",
      variants: [
        { sku: "BED-PLAT-Q", name: "Queen", size: "Queen", priceCents: 64900, costCents: 29000, onHandShowroom: 2, onHandWarehouse: 6 },
        { sku: "BED-PLAT-K", name: "King", size: "King", priceCents: 74900, costCents: 34000, onHandShowroom: 1, onHandWarehouse: 4 },
      ],
    },
    {
      name: "King Bed Frame — Upholstered",
      slug: "king-bed-frame-upholstered",
      categorySlug: "beds",
      brand: "Big Ed's Select",
      description: "Upholstered king headboard and frame with nailhead trim.",
      variants: [
        { sku: "BED-UPH-KNG", name: "King", size: "King", priceCents: 84900, costCents: 39000, onHandShowroom: 0, onHandWarehouse: 3 },
      ],
    },
    {
      name: "Hybrid Memory Foam Mattress",
      slug: "hybrid-memory-foam-mattress",
      categorySlug: "mattresses",
      brand: "RestWell",
      description: "Medium-firm hybrid with cooling gel foam layer.",
      variants: [
        { sku: "MAT-HYB-Q", name: "Queen", size: "Queen", priceCents: 69900, costCents: 31000, onHandShowroom: 2, onHandWarehouse: 10 },
        { sku: "MAT-HYB-K", name: "King", size: "King", priceCents: 89900, costCents: 41000, onHandShowroom: 1, onHandWarehouse: 7 },
      ],
    },
    {
      name: "6-Piece Dining Set",
      slug: "6-piece-dining-set",
      categorySlug: "dining",
      brand: "Apex",
      description: "Solid-wood table with six upholstered chairs.",
      variants: [
        { sku: "DIN-6PC-OAK", name: "Oak", color: "Oak", priceCents: 129900, costCents: 61000, onHandShowroom: 1, onHandWarehouse: 2 },
      ],
    },
    {
      name: "Classic 3-Seat Sofa",
      slug: "classic-3-seat-sofa",
      categorySlug: "sofas",
      brand: "Big Ed's Select",
      description: "Timeless rolled-arm sofa in stain-resistant fabric.",
      variants: [
        { sku: "SOF-CLS-BGE", name: "Beige", color: "Beige", priceCents: 59900, costCents: 27000, onHandShowroom: 3, onHandWarehouse: 8 },
        { sku: "SOF-CLS-NVY", name: "Navy", color: "Navy", priceCents: 59900, costCents: 27000, onHandShowroom: 1, onHandWarehouse: 5 },
      ],
    },
  ];

  for (const productDef of productDefs) {
    const product = await prisma.product.upsert({
      where: { slug: productDef.slug },
      update: {},
      create: {
        name: productDef.name,
        slug: productDef.slug,
        description: productDef.description,
        brand: productDef.brand,
        status: "ACTIVE",
        categoryId: categories[productDef.categorySlug].id,
      },
    });

    for (const v of productDef.variants) {
      const variant = await prisma.variant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          productId: product.id,
          sku: v.sku,
          name: v.name,
          color: v.color,
          size: v.size,
          priceCents: v.priceCents,
          costCents: v.costCents,
        },
      });

      await prisma.stockBalance.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: showroom.id } },
        update: { onHand: v.onHandShowroom },
        create: { variantId: variant.id, locationId: showroom.id, onHand: v.onHandShowroom },
      });
      await prisma.stockBalance.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: warehouse.id } },
        update: { onHand: v.onHandWarehouse },
        create: { variantId: variant.id, locationId: warehouse.id, onHand: v.onHandWarehouse },
      });

      const existingMovement = await prisma.stockMovement.findFirst({
        where: { variantId: variant.id, type: "RECEIPT", referenceType: "Seed" },
      });
      if (!existingMovement) {
        if (v.onHandShowroom > 0) {
          await prisma.stockMovement.create({
            data: {
              variantId: variant.id,
              locationId: showroom.id,
              type: "RECEIPT",
              quantity: v.onHandShowroom,
              referenceType: "Seed",
              reasonCode: "initial_seed",
            },
          });
        }
        if (v.onHandWarehouse > 0) {
          await prisma.stockMovement.create({
            data: {
              variantId: variant.id,
              locationId: warehouse.id,
              type: "RECEIPT",
              quantity: v.onHandWarehouse,
              referenceType: "Seed",
              reasonCode: "initial_seed",
            },
          });
        }
      }
    }
  }

  console.log("Seeding a sample purchase order...");
  const comfortDist = suppliers[0];
  const sampleVariant = await prisma.variant.findUnique({ where: { sku: "REC-POWER-BLK" } });
  const existingPO = await prisma.purchaseOrder.findFirst({ where: { poNumber: "PO-1048" } });
  if (!existingPO && sampleVariant) {
    await prisma.purchaseOrder.create({
      data: {
        poNumber: "PO-1048",
        supplierId: comfortDist.id,
        status: "PARTIALLY_RECEIVED",
        locationId: warehouse.id,
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lines: {
          create: [
            {
              variantId: sampleVariant.id,
              skuSnapshot: sampleVariant.sku,
              expectedQty: 10,
              receivedQty: 4,
              unitCostCents: sampleVariant.costCents ?? 18000,
            },
          ],
        },
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
