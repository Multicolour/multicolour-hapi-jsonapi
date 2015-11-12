"use strict"

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
  register() {
    // Get the server and decorator name.
    const generator = this.get("generator")
    const server = generator.request("raw")
    const name = this.get("decorator_name")

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
