"use strict"

// Get our tools.
const joi = require("joi")
const tape = require("tape")
const Multicolour = require("multicolour")
const reply_payloads = require("./payloads/reply")

const relations = {
  pet: [ "owners" ],
  collar: [ "pet" ],
  person: [ "user" ]
}

// Set up a dummy service.
const service = new Multicolour({
  content: `${__dirname}/assets`,
  db: {
    adapters: {
      development: require("sails-memory")
    },
    connections: {
      development: {
        adapter: "development"
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
const headers = { accept: "application/vnd.api+json" }

// Run the tests.
service.get("database").start(ontology => {
  require("./assets/data")(ontology, () => {

    // Generate the routes from the models in the database.
    service.get("server").generate_routes()
    service.trigger("server_starting")

    // Run the test with a helpful name.
    tape(`Error "generate_payload" functional tests.`, test => {
      const entity = service.get("server").get("validator")
      test.throws(entity.generate_payload, TypeError, "Throws when incorrectly called without data or collection.")
      test.throws(() => entity.generate_payload({ isBoom: true }, ontology.user), TypeError, "Throws when incorrectly called without data or collection.")
      test.throws(() => entity.generate_payload({ isBoom: false, is_error: false }), TypeError, "Throws when incorrectly called without error payload or collection.")
      test.end()
    })

    // Loop over the payloads.
    Object.keys(reply_payloads).forEach(test_name => {
      const options = {
        url: `/${test_name}`,
        method: "GET",
        headers
      }

      // Run the test with a helpful name.
      tape(`GET /${test_name}.`, test => {
        hapi.inject(options, response => {
          test.equal(response.statusCode, 200, "Response code should be 200")
          test.equal(joi.validate(JSON.parse(response.payload), reply_payloads[test_name]).error, null, "Payload validation should have no errors.")
          test.end()
        })
      })

      if (relations[test_name].length > 0) {
        tape(`GET /${test_name}/1/relationships tests`, test => {
          test.plan(relations[test_name].length)
          relations[test_name].forEach(relation => {
            hapi.inject({
              url: `/${test_name}/1/relationships/${relation}`,
              method: "GET",
              headers
            }, response => {
              test.equal(response.statusCode, 200, `GET /${test_name}/1/relationships/${relation}: Response code should be 200`)
              // test.equal(joi.validate(JSON.parse(response.payload), reply_payloads[test_name]).error, null, "Payload validation should have no errors.")
            })
          })
        })
      }

      tape("Test error response", test => {
        hapi.inject(`/${test_name}`, response => {
          test.equal(response.statusCode, 400, "Response code should be 400")
          test.equal(joi.validate(JSON.parse(response.payload), reply_payloads[test_name]).error, null, "Error payload validation should have no errors.")
          test.end()
        })
      })
    })
  })
})
