/*
  Warnings:

  - You are about to drop the column `img` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `imgHeight` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `video` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "img",
DROP COLUMN "imgHeight",
DROP COLUMN "video";

-- CreateTable
CREATE TABLE "PostMedia" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "height" INTEGER,
    "width" INTEGER,
    "postId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
