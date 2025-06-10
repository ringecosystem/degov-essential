import "reflect-metadata";

import Container from "typedi";
import { DegovMcpHttpServer } from "./server";
import { ConfigReader } from "./integration/config-reader";

async function main() {
  const host = ConfigReader.read("app.host", { defaultValue: "127.0.0.1" })!;
  const port = parseInt(
    ConfigReader.read("app.port", { defaultValue: "3000" })!,
    10
  );
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
