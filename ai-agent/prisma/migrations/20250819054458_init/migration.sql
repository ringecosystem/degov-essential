-- CreateTable
CREATE TABLE "ens_record" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ens_name" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ens_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ens_text_record" (
    "id" TEXT NOT NULL,
    "ens_record_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "ctime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ens_text_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ens_record_address_idx" ON "ens_record"("address");

-- CreateIndex
CREATE INDEX "ens_record_ens_name_idx" ON "ens_record"("ens_name");

-- CreateIndex
CREATE UNIQUE INDEX "ens_record_address_ens_name_key" ON "ens_record"("address", "ens_name");

-- CreateIndex
CREATE INDEX "ens_text_record_key_idx" ON "ens_text_record"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ens_text_record_ens_record_id_key_key" ON "ens_text_record"("ens_record_id", "key");

-- AddForeignKey
ALTER TABLE "ens_text_record" ADD CONSTRAINT "ens_text_record_ens_record_id_fkey" FOREIGN KEY ("ens_record_id") REFERENCES "ens_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
