"use strict"

module.exports = {
  attributes: {
    breed: "string",
    type: "string",
    name: "string",

    // Add a reference to User.
    owner: {
      model: "user"
    },

    // Add a reference to Collar.
    collar: {
      model: "collar"
    }
  }
}
