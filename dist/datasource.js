"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CosmosDataSource = void 0;
const apollo_datasource_1 = require("apollo-datasource");
const apollo_server_errors_1 = require("apollo-server-errors");
const apollo_server_caching_1 = require("apollo-server-caching");
const helpers_1 = require("./helpers");
const cache_1 = require("./cache");
const placeholderHandler = () => {
    throw new Error("DataSource not initialized");
};
class CosmosDataSource extends apollo_datasource_1.DataSource {
    constructor(container, options = {}) {
        var _a;
        super();
        // these get set by the initializer but they must be defined or nullable after the constructor
        // runs, so we guard against using them before init
        this.findOneById = placeholderHandler;
        this.findManyByIds = placeholderHandler;
        this.deleteFromCacheById = placeholderHandler;
        this.primeLoader = placeholderHandler;
        (_a = options === null || options === void 0 ? void 0 : options.logger) === null || _a === void 0 ? void 0 : _a.info(`CosmosDataSource started`);
        if (!helpers_1.isCosmosDbContainer(container)) {
            throw new apollo_server_errors_1.ApolloError("CosmosDataSource must be created with a CosmosDb container (from @azure/cosmos)");
        }
        this.options = options;
        this.container = container;
    }
    /**
     *
     * @param query
     * @param param1
     */
    findManyByQuery(query, { ttl, requestOptions } = {}) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.logger) === null || _b === void 0 ? void 0 : _b.debug(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            `findManyByQuery: CosmosQuery: ${query.query || query}`);
            const results = yield this.container.items
                .query(query, requestOptions)
                .fetchAll();
            // prime these into the dataloader and maybe the cache
            if (this.dataLoader && results.resources) {
                this.primeLoader(results.resources, ttl);
            }
            (_d = (_c = this.options) === null || _c === void 0 ? void 0 : _c.logger) === null || _d === void 0 ? void 0 : _d.info(`CosmosDataSource.findManyByQuery: complete. rows: ${results.resources.length}, RUs: ${results.requestCharge}, hasMoreResults: ${results.hasMoreResults}`);
            return results;
        });
    }
    createOne(newDoc, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const { requestOptions } = options;
            const response = yield this.container.items.create(newDoc, requestOptions);
            if (response.resource) {
                this.primeLoader(response.resource, options.ttl);
            }
            return response;
        });
    }
    deleteOne(id) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.logger) === null || _b === void 0 ? void 0 : _b.info(`CosmosDataSource/deleteOne: deleting id: '${id}'`);
            const response = yield this.container.item(id, id).delete();
            yield this.deleteFromCacheById(id);
            return response;
        });
    }
    updateOne(updDoc) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.container
                .item(updDoc.id, updDoc.id)
                .replace(updDoc);
            if (response.resource) {
                this.primeLoader(response.resource);
            }
            return response;
        });
    }
    updateOnePartial(id, contents) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.logger) === null || _b === void 0 ? void 0 : _b.debug(`Updating doc id ${id} contents: ${JSON.stringify(contents, null, "")}`);
            const item = this.container.item(id, id);
            const docItem = yield item.read();
            const { resource } = docItem;
            const newResource = Object.assign(Object.assign(Object.assign({}, resource), contents), { id }); // don't change the ID ever
            const replaceResult = yield item.replace(newResource);
            if (replaceResult.resource) {
                this.primeLoader(replaceResult.resource);
            }
            return replaceResult;
        });
    }
    initialize({ context, cache, } = {}) {
        this.context = context;
        const methods = cache_1.createCachingMethods({
            container: this.container,
            cache: cache || new apollo_server_caching_1.InMemoryLRUCache(),
            options: this.options,
        });
        Object.assign(this, methods);
    }
}
exports.CosmosDataSource = CosmosDataSource;
//# sourceMappingURL=datasource.js.map