"use strict"

// Get our tools.
const joi = require("joi")
const extend = require("util")._extend
const waterline_joi = require("waterline-joi")
const handlers = require("multicolour/lib/handlers")
const utils = require("./utils")

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

    return this
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
    // Used in an .apply later.
    const response_alternatives = joi.alternatives()

    // Return the schemas.
    return response_alternatives.try.apply(
      response_alternatives,
      validators.map(validator => validator.get_response_schema(collection))
    )
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
      .options({ allowUnknown: true })

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
        const name = model.adapter.identity

        // Get any relationships this model has.
        const model_relationships = Object.keys(attributes)
          .filter(attribute_name => model._attributes[attribute_name].model || model._attributes[attribute_name].collection)

        // Maps the relationship name back to the relevant
        // model in the collections array.
        const relationship_to = {}
        model_relationships.forEach(relationship_name => {
          const related_model = collections[model._attributes[relationship_name].model || model._attributes[relationship_name].collection]

          relationship_to[relationship_name] = related_model
        })

        // Route those relationships.
        server.route(
          model_relationships.map(relationship_name => {
            let query_key = model._attributes[relationship_name].model ? "id" : name

            return {
              method: "GET",
              path: `/${name}/{${query_key}}/relationships/${relationship_name}`,
              config: {
                auth: this.get_auth_config(model, multicolour.get("server").request("auth_config")),
                handler: (request, reply) => {
                  // Merge the params into the query string params.
                  request.url.query = extend(request.url.query, request.params)

                  // Call the handler.
                  if (query_key === "id") {
                    return handlers.GET.call(model, request, (err, models) => {
                      if (err) {
                        /* istanbul ignore next */
                        reply[request.headers.accept](err, model)
                      }
                      else {
                        // Get the ids of the related models.
                        const ids = models.map(model => model[relationship_name] && model[relationship_name].id)

                        // Get them.
                        relationship_to[relationship_name]
                          .find({ id: ids })
                          .populateAll()
                          .exec((err, models) =>
                            reply[request.headers.accept](models.map(model => model.toJSON()), relationship_to[relationship_name]))
                      }
                    })
                  }
                  else {
                    return handlers.GET.call(relationship_to[relationship_name], request, (err, models) =>
                      reply[request.headers.accept](err || models, relationship_to[relationship_name])
                    )
                  }
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
                  schema: this.get_response_schemas(multicolour.get("server").get("validators"), relationship_to[relationship_name])
                      .meta({ className: `related_${relationship_name}` })
                }
              }
            }
          })
        )
      })
  }

  /**
   * Get the read only schema for a collection.
   * @param  {Waterline.Collection} collection to get payload for.
   * @return {Joi.Schema} Schema for any requests.
   */
  get_response_schema(collection) {
    // Clone the attributes.
    const attributes = utils.clone_attributes(collection._attributes)

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
      relationships: joi.object()
    })

    // This is an `alternatives` because entities may,
    // or may not be a singular and there might have
    // been an error.
    return joi.alternatives().try(
      joi.object({
        data: joi.alternatives().try(
          joi.array().items(data_payload),
          data_payload
        ),
        links: joi.object({
          self: joi.string().uri(),
          last: joi.string().uri(),
          next: joi.string().uri()
        }),
        included: joi.array()
      }),
      joi.object({
        errors: joi.alternatives().try(joi.array().items(joi.object()), joi.object())
      })
    )
  }

  /**
   * Get the schema for write operations.
   * @param  {Waterline.Collection} collection to get payload for.
   * @return {Joi.Schema} Schema for any requests.
   */
  get_payload_schema(collection) {
    // Get our tools.
    const attributes = utils.clone_attributes(collection._attributes)

    // Extend our attributes over some Waterline defaults.
    extend({
      id: collection._attributes.id,
      createdAt: collection._attributes.createdAt,
      updatedAt: collection._attributes.updatedAt
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
  generate_payload(results, collection) {
    // Check for ambiguity.
    if (!collection && (!results.isBoom && !results.is_error)) {
      throw new TypeError(`
        Results not error and no collection for reply.\n
        Results arg is:
          ${results}

        Collection arg is: ${collection.adapter.identity}
      `)
    }

    // Get the JSON API formatter.
    const JSONAPIModel = require("waterline-jsonapi")

    // Check if it's an error.
    if (results.isBoom || results.is_error || results instanceof Error) {
      // Create the jsonapi formatted response.
      return this.response(JSONAPIModel.new_from_error(results, collection).toJSON())
    }
    else {
      // Create the jsonapi formatted response.
      return this.response(JSONAPIModel.create(results, collection).toJSON())
    }
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

    // We need the host setting on the handlers
    // so that they can fetch various models.
    handlers.set_host(multicolour)

    // Add this validator to the list.
    Multicolour_Server_Hapi.get("validators").push(this)

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
