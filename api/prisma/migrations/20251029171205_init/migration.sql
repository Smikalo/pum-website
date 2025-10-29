-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "avatar" TEXT,
    "headline" TEXT,
    "shortBio" TEXT,
    "longBio" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "links" JSONB,
    "photos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tech" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tech_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "year" INTEGER,
    "status" TEXT,
    "demoUrl" TEXT,
    "imageUrl" TEXT,
    "cover" TEXT,
    "images" JSONB,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateStart" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "locationName" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "description" TEXT,
    "photos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberSkill" (
    "memberId" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,

    CONSTRAINT "MemberSkill_pkey" PRIMARY KEY ("memberId","skillId")
);

-- CreateTable
CREATE TABLE "MemberTech" (
    "memberId" TEXT NOT NULL,
    "techId" INTEGER NOT NULL,

    CONSTRAINT "MemberTech_pkey" PRIMARY KEY ("memberId","techId")
);

-- CreateTable
CREATE TABLE "MemberProject" (
    "memberId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT,
    "contribution" TEXT,

    CONSTRAINT "MemberProject_pkey" PRIMARY KEY ("memberId","projectId")
);

-- CreateTable
CREATE TABLE "MemberEvent" (
    "memberId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "MemberEvent_pkey" PRIMARY KEY ("memberId","eventId")
);

-- CreateTable
CREATE TABLE "ProjectTech" (
    "projectId" TEXT NOT NULL,
    "techId" INTEGER NOT NULL,

    CONSTRAINT "ProjectTech_pkey" PRIMARY KEY ("projectId","techId")
);

-- CreateTable
CREATE TABLE "ProjectTag" (
    "projectId" TEXT NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "ProjectTag_pkey" PRIMARY KEY ("projectId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_slug_key" ON "Member"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tech_name_key" ON "Tech"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSkill" ADD CONSTRAINT "MemberSkill_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSkill" ADD CONSTRAINT "MemberSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberTech" ADD CONSTRAINT "MemberTech_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberTech" ADD CONSTRAINT "MemberTech_techId_fkey" FOREIGN KEY ("techId") REFERENCES "Tech"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProject" ADD CONSTRAINT "MemberProject_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProject" ADD CONSTRAINT "MemberProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEvent" ADD CONSTRAINT "MemberEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEvent" ADD CONSTRAINT "MemberEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTech" ADD CONSTRAINT "ProjectTech_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTech" ADD CONSTRAINT "ProjectTech_techId_fkey" FOREIGN KEY ("techId") REFERENCES "Tech"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
