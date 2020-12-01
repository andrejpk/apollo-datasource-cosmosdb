import { DataSource } from "apollo-datasource";
import { ApolloError } from "apollo-server-errors";
import { InMemoryLRUCache, KeyValueCache } from "apollo-server-caching";
import { Container, SqlQuerySpec } from "@azure/cosmos";
import { Logger } from "./helpers";

import { isCosmosDbContainer } from "./helpers";
import { createCachingMethods, CachedMethods, FindArgs } from "./cache";
import DataLoader from "dataloader";

export interface CosmosDataSourceOptions {
  logger?: Logger;
}

const placeholderHandler = () => {
  throw new Error("DataSource not initialized");
};

export class CosmosDataSource<TData extends { id: string }, TContext = any>
  extends DataSource<TContext>
  implements CachedMethods<TData> {
  container: Container;
  context?: TContext;
  private options: CosmosDataSourceOptions;
  // these get set by the initializer but they must be defined or nullable after the constructor
  // runs, so we guard against using them before init
  findOneById: CachedMethods<TData>["findOneById"] = placeholderHandler;
  findManyByIds: CachedMethods<TData>["findManyByIds"] = placeholderHandler;
  deleteFromCacheById: CachedMethods<TData>["deleteFromCacheById"] = placeholderHandler;
  dataLoader: CachedMethods<TData>["dataLoader"];
  primeLoader: CachedMethods<TData>["primeLoader"] = placeholderHandler;

  async findManyByQuery(query: SqlQuerySpec | string, { ttl }: FindArgs = {}) {
    const results = await this.container.items.query<TData>(query).fetchAll();
    // prime these into the dataloader and maybe the cache
    if (this.dataLoader && results.resources) {
      this.primeLoader(results.resources, ttl);
    }
    return results.resources;
  }

  constructor(container: Container, options: CosmosDataSourceOptions = {}) {
    super();
    console.log(`options: ${options.logger}`);
    options?.logger?.info(`CosmosDataSource started`);

    if (!isCosmosDbContainer(container)) {
      throw new ApolloError(
        "CosmosDataSource must be created with a CosmosDb container (from @azure/cosmos)"
      );
    }

    this.options = options;
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
      options: this.options,
    });

    Object.assign(this, methods);
  }
}
