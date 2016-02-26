"use strict"

module.exports = (ontology, callback) => {
  return ontology.collections.multicolour_user.create({
    username: "multicolour-hapi-jsonapi",
    name: "New World Code"
  })
  /* eslint-disable */
  .catch(console.log.bind(console))
  /* eslint-enable */
  .then(() => {
    ontology.collections.person.create([
      {
        name: "Nikola Tesla",
        age: 27,
        user: 1
      },
      {
        name: "Marconi",
        age: 27,
        user: 1
      }
    ])
    .then(() => {
      ontology.collections.pet.create([
        {
          breed: "beagle",
          type: "dog",
          name: "Astro"
        },
        {
          breed: "beagle",
          type: "dog",
          name: "Cosmo"
        }
      ])
      .then(() => {
        ontology.collections.pet
          .find({})
          .exec((err, pets) => {
            pets.forEach(pet => {
              pet.owners.add(1)
              pet.owners.add(2)
              pet.save(() => {})
            })
          })
      })
      .then(callback)
    })
  })
}
