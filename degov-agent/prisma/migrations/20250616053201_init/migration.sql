-- CreateTable
CREATE TABLE "proposal_summary" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_summary_pkey" PRIMARY KEY ("id")
);
