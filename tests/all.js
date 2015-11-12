"use strict"

// Get our tools.
const tape = require("tape")
const Multicolour = require("multicolour")
const reply_payloads = require("./payloads/reply")

// Set up a dummy service.
const service = new Multicolour({
  content: `${__dirname}/assets`,
  db: {
    adapters: {
      development: require("sails-memory")
    },
    connections: {
      development: {
        adapter: "development",
        host: "localhost",
        port: 27017,
        database: "multicolour"
      }
    }
  }
}).scan()

service
  .use(require("multicolour-server-hapi"))
  .get("server").use(require("../index"))

// Disable CSRF for the tests.
service.get("server").reply("csrf_enabled", false)

// Get the raw server for injections.
const hapi = service.get("server").request("raw")

// Run the tests.
service.get("database").start(() => {
  // Generate the routes from the models in the database.
  service.get("server").generate_routes()

  // Loop over the payloads.
  Object.keys(reply_payloads).forEach(test_name => {
    // Run the test with a helpful name.
    tape(`GET /${test_name} test collection.`, test => {
      // Create a request to the server without starting it.
      hapi.inject(`/${test_name}`, response => {
        console.log(response.statusCode, response.payload)
        test.equal(response.statusCode, 200)
        test.deepEqual(response.payload, reply_payloads[test_name])
        test.end()
      })
    })

  })
})
