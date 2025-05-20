import { DataSource } from "apollo-datasource";
import { ApolloError } from "apollo-server-errors";
import { InMemoryLRUCache, KeyValueCache } from "apollo-server-caching";
import { Container, SqlQuerySpec, FeedOptions } from "@azure/cosmos";
import { Logger } from "./helpers";

import { isCosmosDbContainer } from "./helpers";
import { createCachingMethods, CachedMethods, FindArgs } from "./cache";


export interface CosmosDataSourceOptions {
  logger?: Logger;
}

const placeholderHandler = () => {
  throw new Error("DataSource not initialized");
};

export interface CosmosQueryDbArgs {
  /** Maps to CosmosDB feed/request options for parameters like maxItemCount
   * See https://docs.microsoft.com/en-us/javascript/api/%40azure/cosmos/feedoptions?view=azure-node-latest
   */
  requestOptions?: FeedOptions;
  /** Specifies the maximum number of items to be returned per page by Cosmos DB.
   * This is a convenience shorthand for `requestOptions: { maxItemCount: value }`.
   * If both are provided, this top-level `maxItemCount` takes precedence.
   */
  maxItemCount?: number;
}

export type QueryFindArgs = FindArgs & CosmosQueryDbArgs;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CosmosDataSource<TData extends { id: string }, TContext = any>
  extends DataSource<TContext>
  implements CachedMethods<TData> {
  container: Container;
  context?: TContext;
  options: CosmosDataSourceOptions;
  // these get set by the initializer but they must be defined or nullable after the constructor
  // runs, so we guard against using them before init
  findOneById: CachedMethods<TData>["findOneById"] = placeholderHandler;
  findManyByIds: CachedMethods<TData>["findManyByIds"] = placeholderHandler;
  deleteFromCacheById: CachedMethods<TData>["deleteFromCacheById"] = placeholderHandler;
  dataLoader: CachedMethods<TData>["dataLoader"];
  primeLoader: CachedMethods<TData>["primeLoader"] = placeholderHandler;

  /**
   *
   * @param query
   * @param param1
   */
  async findManyByQuery(
    query: string | SqlQuerySpec,
    { ttl, requestOptions, maxItemCount }: QueryFindArgs = {}
  ) {
    this.options?.logger?.debug(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      `findManyByQuery: CosmosQuery: ${(query as any).query || query}`
    );

    const finalRequestOptions: FeedOptions = { ...requestOptions };
    if (maxItemCount !== undefined) {
      finalRequestOptions.maxItemCount = maxItemCount;
    }

    const iterator = this.container.items.query<TData>(query, finalRequestOptions);
    const results = await iterator.fetchNext();

    // prime these into the dataloader and maybe the cache
    if (this.dataLoader && results.resources) {
      this.primeLoader(results.resources, ttl);
    }
    this.options?.logger?.info(
      `CosmosDataSource.findManyByQuery: complete. rows: ${results.resources.length}, RUs: ${results.requestCharge}, hasMoreResults: ${results.hasMoreResults}`
    );
    return results;
  }

  async createOne(newDoc: TData, options: QueryFindArgs = {}) {
    const { requestOptions } = options;
    const response = await this.container.items.create<TData>(
      newDoc,
      requestOptions
    );
    if (response.resource) {
      this.primeLoader(response.resource, options.ttl);
    }
    return response;
  }

  async deleteOne(id: string, partitionKey?: string) {
    this.options?.logger?.info(
      `CosmosDataSource/deleteOne: deleting id: '${id}'`
    );
    const response = await this.container.item(id, partitionKey).delete<TData>();
    await this.deleteFromCacheById(id);
    return response;
  }

  async updateOne(updDoc: TData, partitionKey?: string) {
    const response = await this.container
      .item(updDoc.id, partitionKey)
      .replace(updDoc);
    if (response.resource) {
      this.primeLoader(response.resource);
    }
    return response;
  }

  async updateOnePartial(id: string, contents: Partial<TData>, partitionKey?: string) {
    this.options?.logger?.debug(
      `Updating doc id ${id} contents: ${JSON.stringify(contents, null, "")}`
    );
    const item = this.container.item(id, partitionKey);
    const docItem = await item.read<TData>();
    const { resource } = docItem;
    const newResource = { ...resource, ...contents, id } as TData; // don't change the ID ever
    const replaceResult = await item.replace<TData>(newResource);
    if (replaceResult.resource) {
      this.primeLoader(replaceResult.resource);
    }

    return replaceResult;
  }

  constructor(container: Container, options: CosmosDataSourceOptions = {}) {
    super();
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
