"use strict"

module.exports = {
  attributes: {
    name: {
      required: true,
      type: "string"
    },

    age: {
      type: "integer",
      required: true,
      size: 8,
      min: 1,
      max: 130
    }
  }
}
