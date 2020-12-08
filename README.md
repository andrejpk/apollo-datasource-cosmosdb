# Apollo DataSource for CosmosDB

This is a CosmosDB DataSource for the Apollo GraphQL Server. It was adapted from the [MongoDB Data Source project](https://github.com/GraphQLGuide/apollo-datasource-mongodb).

## Usage

Use by creating a new class, inheriting from `CosmsosDBDataSource` passing in the CosmosDb container instance (created from the CosmosDB Javascript API)

`data-sources/Users.ts`

```typescript
export class UserDataSource extends CosmosDataSource<UserDoc, ApolloContext> {}
```

`server.ts`

```typescript
import { CosmosClient } from "@azure/cosmos";

const cosmosClient = new CosmosClient({
  endpoint: "https://my-cosmos-db.documents.azure.com:443/",
  key: "--------key-goes-here---==",
});
const cosmosContainer = cosmosClient.database("MyDatabase").container("Items");

import UserDataSource from "./data-sources/Users.js";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    users: new UserDataSource(cosmosContainer),
  }),
});
```

## Custom Queries

CosmosDataSource exposes a `findManyByQuery` method that accepts a ComosDB SQL query either as a string or a `SqlQuerySpec` object containing the query and a parameter collection. This can be used direclty in the resolvers, but probably better to create wrappers that hide the query details:

```typescript
export class UserDataSource extends CosmosDataSource<UserDoc, ApolloContext> {
  findManyByGroupID = async (group_id, args: FindArgs = {}) => {
    log.debug(`UserDataSource: getGroupUsers ${group_id}`);
    const query = `SELECT * FROM c where c.type = "User" and exists(select * from g in c.groups where g = @group_id) `;
    const results = await this.findManyByQuery(
      {
        query,
        parameters: [{ name: "@group_id", value: group_id }],
      },
      args
    );
    log.debug(`Result count ${results.resources.length}`);
    return results.resources;
  };
  findOneByUserName = async (userName: string, args: FindArgs = {}) => {
    const results = await this.findManyByQuery(
      {
        query: `SELECT * FROM c WHERE c.userName = @userName AND c.type = 'User'`,
        parameters: [{ name: "@userName", value: userName }],
      },
      args
    );
    if (results.resources && results.resources.length)
      return results.resources[0];
    return undefined;
  };
}
```

## Write Operations

This DataSource has some built in mutation methods to create, update and delete items. They can be used directly in resolvers or wrapped with custom methods.

```typescript
await context.dataSources.users.createOne(userDoc);

await context.dataSources.uploads.deleteOne(uploadKey);
```

The data loader (and cache, if used) are updated after mutation operations.

## Batching

Batching is provided on all queries using the DataLoader library.

## Caching

Caching is available on an opt-in basis by passing a `ttl` option on queries.

## Typescript

This library is written in Typescript and exports full type definitions, but usable in pure Javascript as well.

# API

```typescript

const thisUser = await users.findOneById(id: string, {ttl})  // => Promise<T>

const userPair = await users.findManyByIds([id1, id2], {ttl}) // => Promise<(T | undefined)[]>

await users.deleteFromCacheById(id}) // => Promise<void>

// query method; note that this returns the CosmosDB FeedResponse object because sometimes this extra information is useful
const userListResponse = await users.findManyByQuery('SELECT * from c where c.type="User"', {ttl, requestOptions}) // => Promise<FeedResponse<T>>
console.log(userListResponse.resources) // user array from query

// create method returns the CosmosDB ItemResponse object
const createResponse = await users.createOne(newUser) // => Promise<ItemResponse<T>>
console.log(createResponse.resource)  // user object returned from create, with CosmosDB-added values

const updateUserResponse = await users.updateOne(thisUser) // => Promise<ItemResponse<T>>

const updatePartialResponse = await users.updateOnePartial(id, {firstName: "Bob"}) // => Promise<ItemResponse<T>>
console.log(updatePartialResponse.resource) // full user object from DB after updates

```
