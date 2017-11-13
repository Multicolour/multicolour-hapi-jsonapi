"use strict"

// Get our tools.
const joi = require("joi")
const extend = require("util")._extend
const waterline_joi = require("waterline-joi")
const utils = require("./utils")
const Waterline_JSONAPI = require("waterline-jsonapi")

// Used a lot below.
const CN_NAME = "application/vnd.api+json"

class Multicolour_Hapi_JSONAPI extends Map {

  /**
   * Set some default options.
   * @param  {Multicolour_Server_Hapi} generator using this plugin.
   * @return {Multicolour_Hapi_JSONAPI} Multicolour_Hapi_JSONAPI for chaining.
   */
  constructor(generator) {
    // Construct.
    super()

    // Set the defaults.
    this.set("multicolour", generator.request("host"))

    const settings = this.get("multicolour").get("config").get("settings") || {}
    const configured_prefix = settings.route_prefix || ""
    this.set("prefix", configured_prefix.endsWith("/") ? configured_prefix.slice(0, -1) : configured_prefix)

    // Generate all the schemas used by the validator.
    this.schemas = this.generate_all_model_schemas()
    this.error_schema = this.get_error_schema()

    return this
  }

  generate_all_model_schemas() {
    const schemas = {
      post: {},
      get: {},
      put: {},
      patch: {},
      delete: {}
    }
    const multicolour = this.get("multicolour")
    const models = multicolour.get("database").get("definitions")

    Object.keys(models)
      .forEach(model_name => {
        const write_schema = this.get_payload_schema(models[model_name])

        schemas.get[model_name] = this.get_response_schema(models[model_name])
        schemas.post[model_name] = write_schema
        schemas.put[model_name] = write_schema
        schemas.patch[model_name] = write_schema
      })

    return schemas
  }

  /**
   * Get any auth configuration
   * @param {Waterline.Collection} Collection to get auth roles from.
   * @param {String|Boolean} Name of the auth strategy to use or false.
   * @return {Object|Boolean} Auth will be false if none, otherwise an object.
   */
  get_auth_config(model, auth_strategy_name) {
    if (!auth_strategy_name) {
      return false
    }

    // If there's a specific role object
    // for this verb, set it.
    if (model.roles) {
      return {
        strategy: auth_strategy_name,
        scope: model.roles.get || model.roles
      }
    }
    // Otherwise, just use the defaults.
    else {
      return {
        strategy: auth_strategy_name,
        scope: ["user", "admin", "consumer"]
      }
    }
  }

  /**
   * There can be many different validators,
   * they can add different content types.
   * @param  {Array} validators to get response schemas from.
   * @param  {Waterline.Collection} collection to get schema for.
   * @return {Array} array of joi schemas.
   */
  get_response_schemas(validators, collection) {
    const attributes = Object.assign({}, collection.attributes || collection._attributes)
    delete attributes.id

    let collection_data = {
      type: collection.adapter.identity,
      id: joi.alternatives().try(joi.string(), joi.number()),
      attributes: waterline_joi(attributes)
    }

    const relationships = {}
    const included = []

    // Make it a joi object.
    collection_data = joi.object(collection_data)

    // Create the basic
    const out = {
      links: joi.object({
        self: joi.string().uri(),
        next: joi.string().uri(),
        last: joi.string().uri()
      }),
      data: joi.alternatives().try(collection_data, joi.array().items(collection_data)),
      relationships: joi.object(relationships),
      included: joi.array().items(included)
    }


    return joi.object(out)
  }

  get_error_schema() {
    const error_schema = joi.object({
      id: joi.string(),
      links: joi.object({
        about: joi.string()
      }),
      status: joi.string().regex(/[0-9]/g),
      code: joi.string().regex(/[0-9]/g),
      title: joi.string(),
      detail: joi.string(),
      source: joi.object({
        pointer: joi.string(),
        parameter: joi.string()
      }),
      meta: joi.object()
    })

    return joi.object({
      errors: joi.alternatives().try(error_schema, joi.array().items(error_schema))
    })
  }

  /**
   * Generate routes for related resources to this model.
   * @param  {Hapi} server to register routes on.
   * @param  {Multicolour} multicolour instance to get config from.
   * @return {void}
   */
  generate_related_resource_routes(server) {
    const multicolour = this.get("multicolour")

    // Get the collections.
    const collections = multicolour.get("database").get("models")

    // Get the models that have associations.
    const models = Object.keys(collections)
      .filter(model_name => !collections[model_name].meta.junctionTable)
      .map(model_name => collections[model_name])

    // Get the headers.
    const headers = joi.object(multicolour.request("header_validator").get())
      .options({allowUnknown: true})

    models
      // Don't do any generation for models that
      // specifically say not to.
      .filter(model => !model.NO_AUTO_GEN_ROUTES)
      // All others, start generating.
      .forEach(model => {
        // Clone the attributes to prevent
        // any accidental overriding/side affects.
        const attributes = utils.clone_attributes(model._attributes)

        // Save typing later.
        const name = model.adapter.identity.replace(/-/g, "_")

        // Get any relationships this model has.
        const model_relationships = Object.keys(attributes)
          .filter(attribute_name =>
            model._attributes[attribute_name].model ||
            model._attributes[attribute_name].collection
          )

        // Maps the relationship name back to the relevant
        // model in the collections array.
        const relationship_to = {}
        model_relationships.forEach(relationship_name => {
          const related_model = collections[model._attributes[relationship_name].model ||
            model._attributes[relationship_name].collection]

          relationship_to[relationship_name] = related_model
        })

        // Route those relationships.
        model_relationships.forEach(relationship_name => {
          // Get the collection.
          const collection = relationship_to[relationship_name]

          // What key will we query for?
          let query_key = model._attributes[relationship_name].model ? "id" : name

          // Create the path
          const path = `${this.get("prefix")}/${name}/{${query_key}}/${relationship_name}`

          // Check we didn't already register a route here.
          if (server.match("GET", path)) {
            return false
          }

          // Return the route.
          server.route({
            method: "GET",
            path,
            config: {
              auth: this.get_auth_config(model, multicolour.get("server").request("auth_config")),
              handler: (request, reply) => {
                // Merge the params into the query string params.
                request.url.query = extend(request.url.query, request.params)

                // Get the response function.
                const respond = reply[request.headers.accept]

                // Get the records.
                model
                  .findOne({id: request.params[query_key]})
                  .exec((err, model) => {
                    if (err) {
                      respond(err, collection)
                    }
                    else if (!model) {
                      respond(null, collection)
                    }
                    else {
                      collection
                        .find({[name]: model.id})
                        .populateAll()
                        .exec((err, models) => {
                          if (err) {
                            respond(err, collection)
                          }
                          else if (!models) {
                            respond(null, collection)
                          }
                          else {
                            respond(models.map(model => model.toJSON()), collection)
                          }
                        })
                    }
                  })
              },
              description: `Get ${relationship_name} related to ${name}.`,
              notes: `Get ${relationship_name} related to ${name}.`,
              tags: ["api", "relationships"],
              validate: {
                headers,
                params: joi.object({
                  [query_key]: joi.string().required()
                })
              },
              response: {
                schema: this.get_response_schemas(multicolour.get("validators"), collection)
                  .meta({className: `related_${relationship_name}`})
              }
            }
          })
        })

        // Route those relationships.
        model_relationships.forEach(relationship_name => {
          // Get the collection.
          const collection = relationship_to[relationship_name]

          // Check the target collection has that association.
          if (!relationship_to[relationship_name]._attributes.hasOwnProperty(name)) {
            return false
          }

          // What key will we query for?
          let query_key = (model._attributes[relationship_name].model ? "id" : name).replace(/-/g, "_")

          // Create the path.
          const path = `${this.get("prefix")}/${name}/{${query_key}}/relationships/${relationship_name}`

          // Check we didn't already register a route here.
          if (server.match("GET", path)) {
            return false
          }

          server.route({
            method: "GET",
            path,
            config: {
              auth: this.get_auth_config(model, multicolour.get("server").request("auth_config")),
              handler: (request, reply) => {
                // Set the meta.
                const meta = {
                  context: "related",
                  is_relationships: true,
                  relationships_type_filter: collection.adapter.identity
                }

                // The decorator method to call.
                const method = request.headers.accept

                // Merge the params into the query string params.
                request.url.query = extend(request.url.query, request.params)

                // Get the records.
                model
                  .findOne({id: request.params[query_key]})
                  .exec((err, model) => {
                    if (err) {
                      reply[method](err, collection)
                    }
                    else if (!model) {
                      reply[method](null, collection)
                    }
                    else {
                      collection
                        .find({[name]: model.id}, {fields: {id: 1, name: 1, [name]: 1}})
                        .exec((err, models) => {
                          if (err) {
                            reply[method](err, collection)
                          }
                          else if (!models) {
                            reply[method](null, collection)
                          }
                          else {
                            reply[method](models.map(model => model.toJSON()), collection, meta)
                          }
                        })
                    }
                  })
              },
              description: `Get ${relationship_name} related to ${name}.`,
              notes: `Get ${relationship_name} related to ${name}.`,
              tags: ["api", "relationships"],
              validate: {
                headers,
                params: joi.object({
                  [query_key]: joi.string().required()
                })
              },
              response: {
                // schema: this.get_related_schema().meta({ className: `related_${relationship_name}` })
              }
            }
          })
        })
      })
  }

  get_links_schema() {
    return joi.object({
      self: joi.string(),
      last: joi.string(),
      next: joi.string(),
      related: joi.string()
    })
  }

  get_related_schema() {
    const data = joi.object({
      id: joi.string().required(),
      type: joi.string().required()
    })

    return joi.alternatives().try(
      this.get_error_schema(),
      joi.object({
        links: this.get_links_schema(),
        data: joi.alternatives().try(joi.array().items(data), data)
      })
    )
  }

  /**
   * Get the read only schema for a collection.
   * @param  {Waterline.Collection} collection to get payload for.
   * @return {Joi.Schema} Schema for any requests.
   */
  get_response_schema(collection) {
    // Clone the attributes.
    const attributes = utils.clone_attributes(collection._attributes || collection.attributes)

    // Get the model since we're going to rid of the `id` attribute.
    const model = utils.check_and_fix_associations(attributes, "object")
    delete model.id

    // Generate a Joi schema from a fixed version of the attributes.
    const payload = waterline_joi(model)

    // Generate the `data` payload schema.
    const data_payload = joi.object({
      id: joi.string().required(),
      type: joi.string().required(),
      attributes: payload,
      relationships: joi.object(),
      links: joi.object()
    })

    return joi.object({
      links: this.get_links_schema(),
      data: joi.alternatives().try(
        joi.array().items(data_payload),
        data_payload,
        joi.allow(null)
      ),
      included: joi.array()
    })
  }

  /**
   * Get the schema for write operations.
   * @param  {Waterline.Collection} collection to get payload for.
   * @return {Joi.Schema} Schema for any requests.
   */
  get_payload_schema(collection) {
    const target = collection._attributes || collection.attributes

    // Get our tools.
    const attributes = utils.clone_attributes(target)

    // Extend our attributes over some Waterline defaults.
    extend({
      id: target.id,
      createdAt: target.createdAt,
      updatedAt: target.updatedAt
    }, attributes)

    // Return the schema.
    return waterline_joi(utils.check_and_fix_associations(attributes, "string"))
  }

  /**
   * This is the actual decorator for the Hapi server.
   * @param  {Array|Object} results from a Waterline query.
   * @param  {Waterline.Collection} collection the results are from.
   * @return {Hapi.Response} Hapi's response object for chaining.
   */
  generate_payload(results, collection, meta) {
    // Check for ambiguity.
    if (!results || !collection) {
      throw new ReferenceError(`
        generate_payload called without results or collection

        results: ${typeof results}
        collection: ${typeof collection}
      `)
    }

    // Check if it's an error.
    const generator = new Waterline_JSONAPI(results, collection, meta)

    // Add the API root url to the generator.
    generator.api_root = this.request.server.info.uri

    let payload

    // Start converting.
    try {
      payload = generator.generate()
    }
    catch (error) {
      return this.response({
        errors: {
          detail: error.message,
          source: error.stack,
          status: "500"
        }
      }).code(500)

      /* eslint-disable */
      console.error(error.message, error.stack)
      /* eslint-enable */
    }

    return this.response(payload)
  }

  /**
   * Register the plugin with the Multicolour server.
   * @return {Multicolour_Hapi_JSONAPI} Multicolour_Hapi_JSONAPI for chaining.
   */
  register(Multicolour_Server_Hapi) {
    // Get the server and decorator name.
    const multicolour = this.get("multicolour")
    const server = Multicolour_Server_Hapi.request("raw")
    const header_validator = Multicolour_Server_Hapi.request("header_validator")

    // Set a new default decorator.
    multicolour.reply("decorator", CN_NAME)

    // Add this validator to the list.
    multicolour.get("validators").set(CN_NAME, this)

    // Update the accept header to the one in the spec.
    header_validator.set("accept", header_validator.get("accept")
      .valid(CN_NAME)
      .default(CN_NAME))

    // Decorate the reply.
    server.decorate("reply", CN_NAME, this.generate_payload)

    // Register related resource endpoints
    // once the database has been started
    // and before the http server is started.
    multicolour.on("server_starting", () =>
      this.generate_related_resource_routes(server, multicolour)
    )

    // Listen for replies so we can transform any boom
    // responses to be JSON API compliant.
    server.ext("onPreResponse", (request, reply) => {
      //  Get the response.
      const response = request.response

      // Check it's a boom response
      // and exit if it isn't.
      if (!response.isBoom) {
        return reply.continue()
      }

      // Modify the outward payload to be
      // a valid JSON API structure.
      response.output.payload = {
        errors: {
          title: response.output.payload.error,
          status: response.output.statusCode,
          detail: response.output.payload.message
        }
      }

      // Continue with any further processing.
      return reply.continue()
    })

    // Return the calling generator.
    return Multicolour_Server_Hapi
  }
}

// Export the plugin.
module.exports = Multicolour_Hapi_JSONAPI
