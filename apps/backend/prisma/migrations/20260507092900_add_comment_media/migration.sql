-- CreateTable
CREATE TABLE "CommentMedia" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "height" INTEGER,
    "width" INTEGER,
    "commentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentMedia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CommentMedia" ADD CONSTRAINT "CommentMedia_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CommentMedia_commentId_idx" ON "CommentMedia"("commentId");

