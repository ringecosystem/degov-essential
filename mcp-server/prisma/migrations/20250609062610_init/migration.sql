-- CreateTable
CREATE TABLE "twitter_authorization" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "access_token" TEXT,
    "access_secret" TEXT,
    "user_id" TEXT,
    "app_id" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitter_authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitter_user" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "profile_url" TEXT,
    "description" TEXT,
    "verified" INTEGER,
    "verified_type" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,
    "raw" TEXT NOT NULL,

    CONSTRAINT "twitter_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitter_tweet" (
    "id" TEXT NOT NULL,
    "text" TEXT,
    "created_at" TIMESTAMP(3),
    "author_id" TEXT,
    "retweet_count" INTEGER,
    "like_count" INTEGER,
    "reply_count" INTEGER,
    "media_url" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,
    "raw" TEXT NOT NULL,

    CONSTRAINT "twitter_tweet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitter_poll" (
    "id" TEXT NOT NULL,
    "duration_minutes" INTEGER,
    "end_datetime" TIMESTAMP(3),
    "voting_status" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitter_poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitter_poll_option" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "votes" INTEGER NOT NULL,
    "poll_id" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitter_poll_option_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "twitter_authorization" ADD CONSTRAINT "twitter_authorization_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "twitter_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitter_tweet" ADD CONSTRAINT "twitter_tweet_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "twitter_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitter_poll_option" ADD CONSTRAINT "twitter_poll_option_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "twitter_poll"("id") ON DELETE SET NULL ON UPDATE CASCADE;
