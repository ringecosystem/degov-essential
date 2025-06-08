-- CreateTable
CREATE TABLE "twitter_authorization" (
    "id" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "auth_method" TEXT NOT NULL,
    "access_token" TEXT,
    "access_secret" TEXT,
    "api_key" TEXT,
    "api_secret_key" TEXT,
    "cookies" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitter_authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitter_user" (
    "id" TEXT NOT NULL,
    "twid" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "profile_url" TEXT,
    "description" TEXT,
    "verified" INTEGER,
    "verified_type" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitter_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "twitter_user_twid_key" ON "twitter_user"("twid");
