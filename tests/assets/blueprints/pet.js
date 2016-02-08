"use strict"

module.exports = {
  attributes: {
    breed: "string",
    type: "string",
    name: "string",
    owners: {
      collection: "person"
    }
  }
}
