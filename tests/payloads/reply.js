"use strict"

// Get the tools.
const joi = require("joi")

const user_schema = joi.object({
  id: joi.string().required(),
  type: joi.string().required(),
  attributes: joi.object({
    username: joi.string().required(),
    name: joi.string().required(),
    requires_password: joi.boolean(),
    requires_email: joi.boolean(),
    createdAt: joi.date(),
    updatedAt: joi.date()
  })
})

const pet_schema = joi.object({
  id: joi.string().required(),
  type: joi.string().required(),
  attributes: joi.object({
    breed: joi.string().required(),
    type: joi.string().required(),
    name: joi.string().required(),
    createdAt: joi.date(),
    updatedAt: joi.date()
  }),
  relationships: joi.object({
    owner: joi.object({
      data: joi.object({
        type: joi.string().required(),
        id: joi.string().required()
      })
    })
  })
})

// Export schemas.
module.exports = {
  pet: joi.object({
    data: joi.array().items(pet_schema),
    included: joi.array().items(user_schema)
  }),
  user: joi.object({
    data: user_schema,
    included: joi.array()
  })
}
