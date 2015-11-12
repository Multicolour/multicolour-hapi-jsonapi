"use strict"

class Multicolour_Hapi_JSONAPI extends Map {

  constructor(generator) {
    // Construct.
    super()

    // Set the defaults.
    this
      .set("decorator_name", "jsonapi")
      .set("generator", generator.request("host"))
  }

  generate_payload(results, collection) {
    // Get the JSON API formatter.
    const JSONAPIModel = require("waterline-jsonapi")

    // Create the jsonapi formatted response.
    return this.response(JSONAPIModel.create(results, collection).toJSON())
  }

  register() {
    // Get the server.
    const generator = this.get("generator")
    const server = generator.request("raw")
    const name = this.get("decorator_name")

    generator.reply("decorator", name)

    // Decorate the reply.
    server.decorate("reply", name, this.generate_payload)

    return generator
  }
}

// Export the required config for Multicolour
// to register and handle.
module.exports = {
  // It's an auth plugin.
  type: require("multicolour/lib/consts").SERVER_TRANSFORMER,

  // The generator is the class above.
  plugin: Multicolour_Hapi_JSONAPI
}
