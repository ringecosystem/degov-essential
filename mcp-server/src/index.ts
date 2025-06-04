import Container from "typedi";
import { DegovMcpServer } from "./server";

import "reflect-metadata";
import 'dotenv/config'

async function main() {
  const host = process.env.HOST || "127.0.0.1";
  const port = parseInt(process.env.PORT || "3000", 10);
  const c = Container.get(DegovMcpServer);
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
