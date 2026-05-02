-- CreateTable
CREATE TABLE "CommunityBannedUser" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "communityId" INTEGER NOT NULL,

    CONSTRAINT "CommunityBannedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityBannedUser_userId_communityId_key" ON "CommunityBannedUser"("userId", "communityId");

-- AddForeignKey
ALTER TABLE "CommunityBannedUser" ADD CONSTRAINT "CommunityBannedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityBannedUser" ADD CONSTRAINT "CommunityBannedUser_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
