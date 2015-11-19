"use strict"

module.exports = (ontology, callback) => {
  return ontology.collections.user.create({
    username: "multicolour-hapi-jsonapi",
    name: "New World Code"
  })
  .catch(console.log.bind(console))
  .then(() => {
    ontology.collections.pet.create([
      {
        breed: "beagle",
        type: "dog",
        name: "Astro",
        owner: 1
      },
      {
        breed: "beagle",
        type: "dog",
        name: "Cosmo",
        owner: 1
      }
    ])
    .then(callback)
  })
}
