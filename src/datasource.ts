import { DataSource } from "apollo-datasource";
import { ApolloError } from "apollo-server-errors";
import { InMemoryLRUCache, KeyValueCache } from "apollo-server-caching";
import { Container } from "@azure/cosmos";

import { isCosmosDbContainer } from "./helpers";
import { createCachingMethods, CachedMethods } from "./cache";

export const placeholderHandler = () => {
  throw new Error("DataSource not initialized");
};

export class CosmosDataSource<TData, TContext = any>
  extends DataSource<TContext>
  implements CachedMethods<TData> {
  container: Container;
  context?: TContext;
  // these get set by the initializer but they must be defined or nullable after the constructor
  // runs, so we guard against using them before init
  findOneById = placeholderHandler;
  findManyByIds = placeholderHandler;
  deleteFromCacheById = placeholderHandler;

  constructor(container: Container) {
    super();

    if (!isCosmosDbContainer(container)) {
      throw new ApolloError(
        "CosmosDataSource must be created with a CosmosDb container (from @azure/cosmos)"
      );
    }

    this.container = container;
  }

  initialize({
    context,
    cache,
  }: { context?: TContext; cache?: KeyValueCache } = {}) {
    this.context = context;

    const methods = createCachingMethods<TData>({
      container: this.container,
      cache: cache || new InMemoryLRUCache(),
    });

    Object.assign(this, methods);
  }
}
