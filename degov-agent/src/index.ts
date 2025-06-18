import "reflect-metadata";

import Container from "typedi";
import { DegovMcpHttpServer } from "./server";
import { EnvReader } from "./integration/env-reader";

async function main() {
  const host = EnvReader.envRequired("HOST", { defaultValue: "127.0.0.1" });
  const port = EnvReader.envInt("PORT", { defaultValue: "3000" });
  const c = Container.get(DegovMcpHttpServer);
  await c.listen({ host, port });
}

main()
  .then()
  .catch((error) => {
    console.error("An error occurred during initialization:", error);
  });

process.on("uncaughtException", (error) => {
  console.error(error);
});
