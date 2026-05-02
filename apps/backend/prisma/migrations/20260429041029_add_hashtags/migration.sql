-- CreateTable
CREATE TABLE "Hashtag" (
    "id" SERIAL NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" INTEGER NOT NULL,
    "hashtagId" INTEGER NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","hashtagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_tag_key" ON "Hashtag"("tag");

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
