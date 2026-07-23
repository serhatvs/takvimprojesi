import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleName } from "@prisma/client";

config({ path: new URL("../../../.env", import.meta.url).pathname });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the development seed.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

const users = [
  {
    email: "student.dev@agu.edu.tr",
    displayName: "Dev Student",
    studentNumber: "S000001",
    roles: [RoleName.STUDENT]
  },
  {
    email: "club.member.dev@agu.edu.tr",
    displayName: "Dev Club Member",
    studentNumber: "S000002",
    roles: [RoleName.STUDENT, RoleName.CLUB_MEMBER]
  },
  {
    email: "club.admin.dev@agu.edu.tr",
    displayName: "Dev Club Admin",
    studentNumber: "S000003",
    roles: [RoleName.STUDENT, RoleName.CLUB_MEMBER, RoleName.CLUB_ADMIN]
  },
  {
    email: "press.dev@agu.edu.tr",
    displayName: "Dev Press Editor",
    roles: [RoleName.PRESS_EDITOR]
  },
  {
    email: "admin.dev@agu.edu.tr",
    displayName: "Dev System Admin",
    roles: [RoleName.SYSTEM_ADMIN]
  }
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        studentNumber: user.studentNumber ?? null,
        roles: {
          deleteMany: {},
          create: user.roles.map((role) => ({ role }))
        }
      },
      create: {
        email: user.email,
        displayName: user.displayName,
        studentNumber: user.studentNumber ?? null,
        roles: {
          create: user.roles.map((role) => ({ role }))
        }
      }
    });
  }

  const clubAdmin = await prisma.user.findUniqueOrThrow({
    where: { email: "club.admin.dev@agu.edu.tr" }
  });

  const club = await prisma.club.upsert({
    where: { slug: "agu-yazilim-kulubu" },
    update: {
      name: "AGU Yazilim Kulubu",
      description: "Gelistirme ortami icin ornek ogrenci kulubu."
    },
    create: {
      name: "AGU Yazilim Kulubu",
      slug: "agu-yazilim-kulubu",
      description: "Gelistirme ortami icin ornek ogrenci kulubu."
    }
  });

  await prisma.clubMembership.upsert({
    where: {
      userId_clubId: {
        userId: clubAdmin.id,
        clubId: club.id
      }
    },
    update: { role: "ADMIN", isActive: true },
    create: {
      userId: clubAdmin.id,
      clubId: club.id,
      role: "ADMIN"
    }
  });

  await prisma.event.upsert({
    where: { slug: "draft-tech-talk" },
    update: {},
    create: {
      clubId: club.id,
      createdById: clubAdmin.id,
      title: "Draft Tech Talk",
      slug: "draft-tech-talk",
      description: "Taslak durumdaki ornek etkinlik.",
      location: "AGU Konferans Salonu",
      status: "DRAFT",
      startsAt: new Date("2026-10-01T10:00:00.000Z"),
      endsAt: new Date("2026-10-01T12:00:00.000Z"),
      capacity: 80
    }
  });

  await prisma.event.upsert({
    where: { slug: "published-campus-meetup" },
    update: {},
    create: {
      clubId: club.id,
      createdById: clubAdmin.id,
      title: "Published Campus Meetup",
      slug: "published-campus-meetup",
      description: "Kampus takviminde yayinlanmis ornek etkinlik.",
      location: "AGU Ogrenci Merkezi",
      status: "PUBLISHED",
      startsAt: new Date("2026-10-10T14:00:00.000Z"),
      endsAt: new Date("2026-10-10T16:00:00.000Z"),
      registrationOpensAt: new Date("2026-09-20T08:00:00.000Z"),
      registrationClosesAt: new Date("2026-10-09T20:59:59.000Z"),
      publishedAt: new Date("2026-09-15T09:00:00.000Z"),
      capacity: 120
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
