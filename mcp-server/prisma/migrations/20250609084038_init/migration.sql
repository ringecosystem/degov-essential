-- AlterTable
ALTER TABLE "twitter_tweet" ALTER COLUMN "raw" DROP NOT NULL;

-- CreateTable
CREATE TABLE "degov_tweet_progress" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "type" TEXT NOT NULL,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "degov_tweet_progress_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "degov_tweet_progress" ADD CONSTRAINT "degov_tweet_progress_id_fkey" FOREIGN KEY ("id") REFERENCES "twitter_tweet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
