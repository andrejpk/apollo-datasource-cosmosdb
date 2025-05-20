import withCosmosDb, { CosmosDB } from "./withCosmosDb";
import { expect } from "chai";

import { CosmosDataSource } from "../src/datasource";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface UserDoc {
  id: string;
  email: string;
  partitionKey?: string;
}

interface Context {
  something: string;
}

class UserDataSource extends CosmosDataSource<UserDoc, Context> {}

describe("basic crud", () => {
  it(
    "should create a doc and read it back, then update it, delete it",
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
      await userDataSource.updateOne({
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

describe("pagination tests", function () {
  let cosmosDB: CosmosDB;
  let userDataSource: UserDataSource;

  before(async function () {
    cosmosDB = new CosmosDB();
    await cosmosDB.createDatabase();
    const { container } = await cosmosDB.createContainer({
      id: "pagination-test-collection",
    });
    userDataSource = new UserDataSource(container);
    userDataSource.initialize({});

    // Create some initial data
    await userDataSource.createOne({ id: "user_page_1", email: "page1@example.com" });
    await userDataSource.createOne({ id: "user_page_2", email: "page2@example.com" });
    await userDataSource.createOne({ id: "user_page_3", email: "page3@example.com" });
  });

  after(async function () {
    await userDataSource.container.delete();
    cosmosDB.close();
  });

  it("should respect maxItemCount when querying", async function () {
    const query = "SELECT * FROM c";
    const results = await userDataSource.findManyByQuery(query, { maxItemCount: 2 });

    expect(results.resources.length).to.equal(2);
    // Note: @vercel/cosmosdb-server might not fully implement hasMoreResults
    // If this assertion fails, it might be a limitation of the simulator
    expect(results.hasMoreResults).to.equal(true); 
  });

  it("should respect maxItemCount via requestOptions when querying", async function () {
    const query = "SELECT * FROM c";
    const results = await userDataSource.findManyByQuery(query, { requestOptions: { maxItemCount: 1 } });

    expect(results.resources.length).to.equal(1);
    // Note: @vercel/cosmosdb-server might not fully implement hasMoreResults
    expect(results.hasMoreResults).to.equal(true);
  });

  it("should return all items if maxItemCount is larger than total items", async function () {
    const query = "SELECT * FROM c";
    const results = await userDataSource.findManyByQuery(query, { maxItemCount: 5 });

    expect(results.resources.length).to.equal(3);
    // In this case, hasMoreResults should be false as all items are returned
    expect(results.hasMoreResults).to.equal(false);
  });
});

describe("partitionKey crud tests", function () {
  let cosmosDB: CosmosDB;

  before(async function () {
    cosmosDB = new CosmosDB();
    await cosmosDB.createDatabase();
  });

  after(function () {
    cosmosDB.close();
  });
  describe("with a partitionKey", function () {
    let userDataSource: UserDataSource;

    beforeEach(async function () {
      const { container } = await cosmosDB.createContainer({
        id: "test-collection",
        partitionKey: "/partitionKey",
      });

      userDataSource = new UserDataSource(container);
      userDataSource.initialize({});
    });

    afterEach(async function () {
      userDataSource.container.delete();
    });

    it("should create and find a user", async function () {
      const user1 = {
        id: "us_one",
        email: "one@example.com",
        partitionKey: "examplePartitionKey",
      };

      // create the user
      const user1Resp = await userDataSource.createOne(user1);
      expect(user1Resp.resource?.id).to.equal("us_one");

      // read the user by ID
      const user1Find1Resp = await userDataSource.findOneById(user1.id);
      expect(user1Find1Resp?.email).to.equal(user1.email);
      expect(user1Find1Resp?.id).to.equal(user1.id);
    });

    it("should create and update a user and find with query", async function () {
      const user1 = {
        id: "us_one",
        email: "one@example.com",
        partitionKey: "examplePartitionKey",
      };

      // create the user
      const user1Resp = await userDataSource.createOne(user1);
      expect(user1Resp.resource?.id).to.equal("us_one");

      // update the user
      const newEmail = "new@example.com";
      await userDataSource.updateOne({
        ...user1,
        email: newEmail,
      });

      // read the user with a query
      const user1FindQueryResp = await userDataSource.findManyByQuery(
        `select * from c where c.id = '${user1.id}'`
      );
      expect(user1FindQueryResp.resources.length).to.equal(1);
      expect(user1FindQueryResp.resources[0].email).to.equal(newEmail);
    });

    it("should create and delete user", async function () {
      const user1 = {
        id: "us_one",
        email: "one@example.com",
        partitionKey: "examplePartitionKey",
      };

      // create the user
      const user1Resp = await userDataSource.createOne(user1);
      expect(user1Resp.resource?.id).to.equal("us_one");

      // delete the user
      await userDataSource.deleteOne(user1.id, user1.partitionKey);

      // try to read the user back out (shouldn't exist)
      const user1Find1Resp2 = await userDataSource.findOneById(user1.id);
      expect(user1Find1Resp2).to.equal(undefined);
    });

    it("should create and not delete user because partitionKey isn't provided", async function () {
      const user1 = {
        id: "us_one",
        email: "one@example.com",
        partitionKey: "examplePartitionKey",
      };

      // create the user
      const user1Resp = await userDataSource.createOne(user1);
      expect(user1Resp.resource?.id).to.equal("us_one");

      // delete the user will fail because partitionKey isn't provided
      userDataSource.deleteOne(user1.id);

      const user1Find1Resp2 = await userDataSource.findOneById(user1.id);
      expect(user1Find1Resp2).to.not.undefined

      expect(user1Find1Resp2?.id).to.equal(user1.id);
      expect(user1Find1Resp2?.email).to.equal(user1.email);
      expect(user1Find1Resp2?.partitionKey).to.equal(user1.partitionKey);
    });
  });
  describe("without a partitionKey", function () {
    let userDataSource: UserDataSource;

    beforeEach(async function () {
      const { container } = await cosmosDB.createContainer({
        id: "test-collection",
      });

      userDataSource = new UserDataSource(container);
      userDataSource.initialize({});
    });

    afterEach(async function () {
      userDataSource.container.delete();
    });

    it("should create and find a user", async function () {
      const user1 = {
        id: "us_one",
        email: "one@example.com",
      };

      // create the user
      const user1Resp = await userDataSource.createOne(user1);
      expect(user1Resp.resource?.id).to.equal("us_one");

      // read the user by ID
      const user1Find1Resp = await userDataSource.findOneById(user1.id);
      expect(user1Find1Resp?.email).to.equal(user1.email);
      expect(user1Find1Resp?.id).to.equal(user1.id);
    });

    it("should create and update a user and find with query", async function () {
      const user1 = {
        id: "us_one",
        email: "one@example.com",
      };

      // create the user
      const user1Resp = await userDataSource.createOne(user1);
      expect(user1Resp.resource?.id).to.equal("us_one");

      // update the user
      const newEmail = "new@example.com";
      await userDataSource.updateOne({
        ...user1,
        email: newEmail,
      });

      // read the user with a query
      const user1FindQueryResp = await userDataSource.findManyByQuery(
        `select * from c where c.id = '${user1.id}'`
      );
      expect(user1FindQueryResp.resources.length).to.equal(1);
      expect(user1FindQueryResp.resources[0].email).to.equal(newEmail);
    });

    it("should create and delete user", async function () {
      const user1 = {
        id: "us_one",
        email: "one@example.com",
      };

      // create the user
      const user1Resp = await userDataSource.createOne(user1);
      expect(user1Resp.resource?.id).to.equal("us_one");

      // delete the user
      await userDataSource.deleteOne(user1.id);

      // try to read the user back out (shouldn't exist)
      const user1Find1Resp2 = await userDataSource.findOneById(user1.id);
      expect(user1Find1Resp2).to.equal(undefined);
    });
  });
});
