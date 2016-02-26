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
    },

    user: {
      model: "multicolour_user"
    }
  },

  roles: {
    get: ["user"]
  }
}
