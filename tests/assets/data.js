"use strict"

module.exports = (ontology, callback) => {
  return ontology.collections.user.create({
    username: "multicolour-hapi-jsonapi",
    name: "New World Code"
  })
  .catch(console.log.bind(console))
  .then(() => {
    ontology.collections.person.create([
      {
        name: "Nikola Tesla",
        age: 27
      },
      {
        name: "Marconi",
        age: 27
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
