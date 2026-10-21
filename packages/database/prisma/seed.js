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
  const categoryGroupDefs = [
    {
      name: "Living Room",
      slug: "living-room",
      children: [
        { name: "Stationary Sofas & Loveseats", slug: "stationary-sofas-loveseats" },
        { name: "Stationary Sectionals", slug: "stationary-sectionals" },
        { name: "Reclining Sofas & Loveseats", slug: "reclining-sofas-loveseats" },
        { name: "Reclining Sectionals", slug: "reclining-sectionals" },
        { name: "Recliners & Lift Chairs", slug: "recliners-lift-chairs" },
        { name: "Sleepers & Futons", slug: "sleepers-futons" },
        { name: "Occasional Tables", slug: "occasional-tables" },
        { name: "TV Stands", slug: "tv-stands" },
      ],
    },
    {
      name: "Bedroom",
      slug: "bedroom",
      children: [
        { name: "Beds", slug: "beds" },
        { name: "Bedroom Furniture", slug: "bedroom-furniture" },
        { name: "Mattresses", slug: "mattresses" },
        { name: "Daybeds", slug: "daybeds" },
        { name: "Bunk Beds", slug: "bunk-beds" },
        { name: "Vanities & Mirrors", slug: "vanities-mirrors" },
      ],
    },
    {
      name: "Dining",
      slug: "dining",
      children: [
        { name: "Dining Room Furniture", slug: "dining-room-furniture" },
        { name: "Barstools", slug: "barstools" },
      ],
    },
    {
      name: "Office",
      slug: "office",
      children: [{ name: "Office & Bookcase", slug: "office-bookcase" }],
    },
    {
      name: "Accessories",
      slug: "accessories",
      children: [{ name: "Home Accessories", slug: "home-accessories" }],
    },
  ];

  const categories = {};
  let groupSortOrder = 0;
  for (const group of categoryGroupDefs) {
    const parent = await prisma.category.upsert({
      where: { slug: group.slug },
      update: { sortOrder: groupSortOrder },
      create: { name: group.name, slug: group.slug, sortOrder: groupSortOrder },
    });
    categories[group.slug] = parent;

    let childSortOrder = 0;
    for (const child of group.children) {
      categories[child.slug] = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { parentId: parent.id, sortOrder: childSortOrder },
        create: { name: child.name, slug: child.slug, parentId: parent.id, sortOrder: childSortOrder },
      });
      childSortOrder += 1;
    }
    groupSortOrder += 1;
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

  console.log("Seed complete. Catalog is empty by design — no demo products/variants seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
