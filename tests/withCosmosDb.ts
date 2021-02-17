import { CosmosClient } from "@azure/cosmos";
import * as net from "net";
import cosmosDBServer from "@zeit/cosmosdb-server";

export default function withCosmosDBServer<R, T extends []>(
  fn: (cosmosDbClient: CosmosClient, ...args: T) => R
) {
  return async (...args: T) => {
    const server = cosmosDBServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await new Promise((resolve: any) => {
      server.listen(0, resolve);
    });
    const { port } = server.address() as net.AddressInfo;

    const client = new CosmosClient({
      endpoint: `https://localhost:${port}`,
      key: "test-master-key",
    });

    try {
      return await fn(client, ...args);
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  };
}
