import cosmosServer from "@zeit/cosmosdb-server";
import { CosmosClient } from "@azure/cosmos";
import withCosmosDb from "./withCosmosDb";
import { expect } from "chai";

import { CosmosDataSource } from "../datasource";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface UserDoc {
  id: string;
  email: string;
}

interface Context {}

class UserDataSource extends CosmosDataSource<UserDoc, Context> {}

describe("basic crud", () => {
  it(
    "should create a doc and read it back",
    withCosmosDb(async (client) => {
      const { database } = await client.databases.create({
        id: "test-database",
      });
      const { container } = await database.containers.create({
        id: "test-collection",
      });

      const userDataSource = new UserDataSource(container);
      userDataSource.initialize({});

      const user1 = {
        id: "us_one",
        email: "one@example.com",
      };

      // create the user
      const user1Resp = await userDataSource.createOne(user1);
      expect(user1Resp.resource?.id).equal("us_one");

      // read the user by ID
      const user1Find1Resp = await userDataSource.findOneById(user1.id);
      expect(user1Find1Resp?.email).equal(user1.email);
      expect(user1Find1Resp?.id).equal(user1.id);

      // update the user
      const newEmail = "new@example.com";
      const user1UpdResp = await userDataSource.updateOne({
        ...user1,
        email: newEmail,
      });

      // read the user with a query
      const user1FindQueryResp = await userDataSource.findManyByQuery(
        `select * from c where c.id = '${user1.id}'`
      );
      expect(user1FindQueryResp.resources.length).equal(1);
      expect(user1FindQueryResp.resources[0].email).equal(newEmail);

      // delete the user
      await userDataSource.deleteOne(user1.id);

      // try to read the user back out (shouldn't exist)
      const user1Find1Resp2 = await userDataSource.findOneById(user1.id);
      expect(user1Find1Resp2).equal(undefined);
    })
  );
});
