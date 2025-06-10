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
