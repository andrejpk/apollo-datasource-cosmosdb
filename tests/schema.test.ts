import { CosmosDataSource } from "../src/datasource";

interface UserDoc {
  id: string;
  email: string;
  partitionKey?: string;
}

interface Context {
  something: string;
}

// normal context specified
class UserDataSource1 extends CosmosDataSource<UserDoc, Context> {}

// no context specified
class UserDataSource2 extends CosmosDataSource<UserDoc> {}