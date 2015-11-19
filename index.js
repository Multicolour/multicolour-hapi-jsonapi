"use strict"

// Get our tools.
const joi = require("joi")
const waterline_joi = require("waterline-joi")

/**
 * Shallow clone the provided object.
 * @param  {Object} attributes to clone.
 * @return {Object} cloned object.
 */
function clone_attributes(attributes) {
  return JSON.parse(JSON.stringify(attributes))
}

/**
 * Check over the associations in the collection
 * and fix them for the payloads.
 * @param  {Object} attributes from a collection.
 * @param  {String} type, either "string" or "object"
 * @return {Object} Fixed object.
 */
function check_and_fix_associations(attributes, type) {
  // If it's a string, remove erroneous keys.
  if (type === "string") {
    delete attributes.id
    delete attributes.createdAt
    delete attributes.updatedAt
  }

  // Loop over the attributes to see if we have
  // any relationship type fields to add validation for.
  for (const attribute in attributes) {
    if (attributes[attribute].hasOwnProperty("model")) {
      attributes[attribute] = type
    }
    else if (attributes[attribute].hasOwnProperty("collection")) {
      attributes[attribute] = type === "object" ? "array" : type
    }
  }

  return attributes
}

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
    this
      .set("decorator_name", "jsonapi")
      .set("generator", generator.request("host"))

    return this
  }

  /**
   * Get the read only schema for a collection.
   * @param  {Waterline.Collection} collection to get payload for.
   * @return {Joi.Schema} Schema for any requests.
   */
  get_response_schema(collection) {
    // Clone the attributes.
    const attributes = clone_attributes(collection._attributes)

    // Get the model since we're going to rid of the `id` attribute.
    const model = check_and_fix_associations(attributes, "object")
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
        errors: joi.alternatives().try(joi.array(), joi.object())
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
    const extend = require("util")._extend
    const attributes = clone_attributes(collection._attributes)

    // Extend our attributes over some Waterline defaults.
    extend({
      id: collection._attributes.id,
      createdAt: collection._attributes.createdAt,
      updatedAt: collection._attributes.updatedAt
    }, attributes)

    // Return the schema.
    return waterline_joi(check_and_fix_associations(attributes, "string"))
  }

  /**
   * This is the actual decorator for the Hapi server.
   * @param  {Array|Object} results from a Waterline query.
   * @param  {Waterline.Collection} collection the results are from.
   * @return {Hapi.Response} Hapi's response object for chaining.
   */
  generate_payload(results, collection) {
    // Get the JSON API formatter.
    const JSONAPIModel = require("waterline-jsonapi")

    // Create the jsonapi formatted response.
    return this.response(JSONAPIModel.create(results, collection).toJSON())
  }

  /**
   * Register the plugin with the Multicolour server.
   * @return {Multicolour_Hapi_JSONAPI} Multicolour_Hapi_JSONAPI for chaining.
   */
  register(Multicolour_Server_Hapi) {
    // Get the server and decorator name.
    const generator = this.get("generator")
    const server = generator.request("raw")
    const name = this.get("decorator_name")

    // Register with the server some properties it requires.
    Multicolour_Server_Hapi
      // Set it's validator to this plugin.
      .set("validator", this)
      // Set the response and payload validators to this plugin's.
      .reply("response_schema", this.get_response_schema.bind(this))
      .reply("payload_schema", this.get_payload_schema.bind(this))
      // Update the accept header to the one in the spec.
      .request("header_validator")
        .set("accept", joi.string()
          .valid("application/vnd.api+json")
          .default("application/vnd.api+json")
          .required())

    // Set the new decorator name.
    generator.reply("decorator", name)

    // Decorate the reply.
    server.decorate("reply", name, this.generate_payload)

    // Return the calling generator.
    return generator
  }
}

// Export the plugin.
module.exports = Multicolour_Hapi_JSONAPI
