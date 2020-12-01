import { Container, Operation } from "@azure/cosmos";
import { KeyValueCache } from "apollo-server-caching";
import DataLoader from "dataloader";
import { EJSON } from "bson";
import { CosmosDataSourceOptions } from "./datasource";
import { isArray } from "util";

// https://github.com/graphql/dataloader#batch-function
const orderDocs = <V>(ids: readonly string[]) => (
  docs: (V | undefined)[],
  keyFn?: (source: V) => string
) => {
  const keyFnDef =
    keyFn ||
    ((source: V & { id?: string }) => {
      if (source.id) return source.id;
      throw new Error(
        "Could not find ID for object; if using an alternate key, pass in a key function"
      );
    });

  const checkNotUndefined = (input: V | undefined): input is V => {
    return Boolean(input);
  };

  const idMap: Record<string, V> = docs
    .filter(checkNotUndefined)
    .reduce((prev: Record<string, V>, cur: V) => {
      prev[keyFnDef(cur)] = cur;
      return prev;
    }, {});
  return ids.map((id) => idMap[id]);
};

export interface createCatchingMethodArgs {
  container: Container;
  cache: KeyValueCache;
  options: CosmosDataSourceOptions;
}

export interface FindArgs {
  ttl?: number;
}

export interface CachedMethods<DType> {
  findOneById: (id: string, args?: FindArgs) => Promise<DType | undefined>;
  findManyByIds: (
    ids: string[],
    args?: FindArgs
  ) => Promise<(DType | undefined)[]>;
  deleteFromCacheById: (id: string) => Promise<void>;
  dataLoader?: DataLoader<string, DType, string>;
  primeLoader: (item: DType | DType[], ttl?: number) => void;
}

export const createCachingMethods = <DType extends { id: string }>({
  container,
  cache,
  options,
}: createCatchingMethodArgs): CachedMethods<DType> => {
  const loader = new DataLoader<string, DType>(async (ids) => {
    options?.logger?.debug(
      `CosmosDataSource/DataLoader: loading for IDs: ${ids}`
    );
    const querySpec = {
      query: "select * from c where ARRAY_CONTAINS(@ids, c.id)",
      parameters: [{ name: "@ids", value: ids }],
    };
    const response = await container.items.query<DType>(querySpec).fetchAll();

    options?.logger?.debug(
      `CosmosDataSource/DataLoader: response count: ${response.resources.length}`
    );
    return orderDocs<DType>(ids)(response.resources);
  });

  const cachePrefix = `cosmos-${container.url}-`;

  const methods: CachedMethods<DType> = {
    findOneById: async (id, { ttl } = {}) => {
      options?.logger?.debug(`CosmosDataSource: Running query for ID ${id}`);
      const key = cachePrefix + id;

      const cacheDoc = await cache.get(key);
      if (cacheDoc) {
        return EJSON.parse(cacheDoc) as DType;
      }

      const doc = await loader.load(id);

      if (Number.isInteger(ttl)) {
        cache.set(key, EJSON.stringify(doc), { ttl });
      }

      return doc;
    },

    findManyByIds: (ids, args = {}) => {
      options?.logger?.debug(`CosmosDataSource: Running query for IDs ${ids}`);
      return Promise.all(ids.map((id) => methods.findOneById(id, args)));
    },

    deleteFromCacheById: async (id) => {
      loader.clear(id);
      await cache.delete(cachePrefix + id);
    },
    /**
     * Loads an item or items into DataLoader and optionally the cache (if TTL is specified)
     * Use this when running a query outside of the findOneById/findManyByIds methos
     * that automatically and transparently do this
     */
    primeLoader: (docs, ttl?: number) => {
      docs = isArray(docs) ? docs : [docs];
      docs.forEach((doc) => {
        const key = doc.id;
        loader.prime(key, doc);
        if (ttl) {
          cache.set(key, EJSON.stringify(doc), { ttl });
        }
      });
    },
    dataLoader: loader,
  };

  return methods;
};
