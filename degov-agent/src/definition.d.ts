import "fastify";
import { FastifyInstance } from "fastify";
import { ToadScheduler } from "toad-scheduler";
import { PrismaClient } from "./generated/prisma";

interface XSnowflakeId {
  generate: () => string;
}

declare module "fastify" {
  interface FastifyInstance {
    snowflake: XSnowflakeId;
    scheduler: ToadScheduler;
    prisma: PrismaClient;
  }
}
