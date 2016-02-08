"use strict"

// Get the tools.
const joi = require("joi")

const errors = joi.object({
  errors: joi.alternatives().try(
    joi.array().items(joi.object()),
    joi.object()
  )
})

const person_schema = joi.object({
  id: joi.string().required(),
  type: joi.string().required(),
  attributes: joi.object({
    name: joi.string().required(),
    age: joi.number().required(),
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

// Export schemas.
module.exports = {
  pet: joi.alternatives().try(
    joi.object({
      data: pet_schema,
      included: joi.array().items(person_schema)
    }),
    joi.object({
      data: joi.array().items(pet_schema),
      included: joi.array().items(person_schema)
    }),
    errors
  ),
  person: joi.alternatives().try(
    joi.object({
      data: joi.alternatives().try(person_schema, joi.array().items(person_schema)),
      included: joi.array()
    }),
    errors
  )
}
