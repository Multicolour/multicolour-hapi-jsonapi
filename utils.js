"use strict"

/**
 * Shallow clone the provided object.
 * @param  {Object} attributes to clone.
 * @return {Object} cloned object.
 */
const clone_attributes = attributes => JSON.parse(JSON.stringify(attributes))

/**
 * Check over the associations in the collection
 * and fix them for the payloads.
 * @param  {Object} attributes from a collection.
 * @param  {String} type, either "string" or "object"
 * @return {Object} Fixed object.
 */
function check_and_fix_associations(attributes, type) {
  const model = clone_attributes(attributes)

  // If it's a string, remove erroneous keys.
  if (type === "string") {
    delete model.id
    delete model.createdAt
    delete model.updatedAt
  }

  // Loop over the attributes to see if we have
  // any relationship type fields to add validation for.
  for (const attribute in model) {
    if (model[attribute].hasOwnProperty("model")) {
      model[attribute] = type
    }
    else if (model[attribute].hasOwnProperty("collection")) {
      model[attribute] = type === "object" ? "array" : type
    }
  }

  return model
}

// Export utils.
module.exports.clone_attributes = clone_attributes
module.exports.check_and_fix_associations = check_and_fix_associations
