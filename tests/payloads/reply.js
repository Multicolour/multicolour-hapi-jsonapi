"use strict"

// Get the tools.
const joi = require("joi")

const errors = joi.object({
  errors: joi.alternatives().try(
    joi.array().items(joi.object()),
    joi.object()
  )
})

// USER
const user_schema = joi.object({
  id: joi.string().required(),
  type: joi.string().required(),
  attributes: joi.object({
    username: joi.string().required(),
    name: joi.string().required(),
    requires_password: joi.boolean(),
    requires_email: joi.boolean(),
    role: joi.string(),
    createdAt: joi.date(),
    updatedAt: joi.date()
  })
})

// PERSON
const person_schema = joi.object({
  id: joi.string().required(),
  type: joi.string().required(),
  attributes: joi.object({
    name: joi.string().required(),
    age: joi.number().required(),
    user: joi.number(),
    createdAt: joi.date(),
    updatedAt: joi.date()
  }),
  relationships: joi.object({
    user: joi.object({
      data: joi.object({
        type: joi.string().required(),
        id: joi.string().required()
      })
    })
  })
})

// PET
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
    owners: joi.object({
      data: joi.alternatives().try(
        joi.object({
          type: joi.string().required(),
          id: joi.string().required()
        }),
        joi.array().items(joi.object({
          type: joi.string().required(),
          id: joi.string().required()
        }))
      )
    })
  })
})

// EXPORT SCHEMAS.
module.exports = {
  pet: joi.alternatives().try(
    joi.object({
      data: joi.alternatives().try(pet_schema, joi.array().items(pet_schema)),
      included: joi.array().items(person_schema)
    }),
    errors
  ),
  person: joi.alternatives().try(
    joi.object({
      data: joi.alternatives().try(person_schema, joi.array().items(person_schema)),
      included: joi.array().items(user_schema)
    }),
    errors
  )
}
