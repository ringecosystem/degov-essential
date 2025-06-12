-- CreateTable
CREATE TABLE "twitter_authorization" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "description" TEXT,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "access_token" TEXT,
    "access_secret" TEXT,
    "user_id" TEXT,
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
    "conversation_id" TEXT,
    "retweet_count" INTEGER,
    "like_count" INTEGER,
    "reply_count" INTEGER,
    "from_agent" INTEGER DEFAULT 0,
    "raw" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

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

-- CreateTable
CREATE TABLE "degov_tweet" (
    "id" TEXT NOT NULL,
    "daocode" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "times_processed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "degov_tweet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degov_vote_progress" (
    "id" TEXT NOT NULL,
    "daocode" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "offset" INTEGER NOT NULL DEFAULT 0,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "degov_vote_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degov_dao_progress" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "last_block_number" INTEGER,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "degov_dao_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "degov_dao_progress_code_key" ON "degov_dao_progress"("code");

-- AddForeignKey
ALTER TABLE "twitter_authorization" ADD CONSTRAINT "twitter_authorization_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "twitter_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitter_tweet" ADD CONSTRAINT "twitter_tweet_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "twitter_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitter_tweet" ADD CONSTRAINT "twitter_tweet_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "twitter_tweet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitter_poll_option" ADD CONSTRAINT "twitter_poll_option_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "twitter_poll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degov_tweet" ADD CONSTRAINT "degov_tweet_id_fkey" FOREIGN KEY ("id") REFERENCES "twitter_tweet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
