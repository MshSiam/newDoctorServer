const express = require("express")
const app = express()
const cors = require("cors")
var admin = require("firebase-admin")
require("dotenv").config()
const { MongoClient } = require("mongodb")

const port = process.env.PORT || 5000

// doctors-potral-firebase-adminsdk-k5234-44978f07e9.json

var serviceAccount = require("./doctors-potral-firebase-adminsdk-k5234-44978f07e9.json")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.woosd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1]

    try {
      const decodedUser = await admin.auth().verifyIdToken(token)
      req.decodedEmail = decodedUser.email
    } catch {}
  }
  next()
}

// console.log(uri)
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

async function run() {
  try {
    await client.connect()
    const database = client.db("doctors_potral")
    const appointmentsCollection = database.collection("appointsments")
    const usersCollection = database.collection("users")

    app.get("/appointsments", verifyToken, async (req, res) => {
      const email = req.query.email
      const date = new Date(req.query.date).toLocaleDateString()

      const query = { email: email, date: date }

      const cursor = appointmentsCollection.find(query)
      const appointments = await cursor.toArray()
      res.json(appointments)
    })

    app.post("/appointsments", async (req, res) => {
      const appointment = req.body
      const result = await appointmentsCollection.insertOne(appointment)
      console.log(result)
      res.json(result)
    })

    // admin matching
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email
      const query = { email: email }

      const user = await usersCollection.findOne(query)
      let isAdmin = false
      if (user?.role === "admin") {
        isAdmin = true
      }
      res.json({ admin: isAdmin })
    })
    // user data post
    app.post("/users", async (req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user)
      console.log(result)
      res.json(result)
    })
    // update data
    app.put("/users", async (req, res) => {
      const user = req.body
      //  we can use query or filter
      const filter = { email: user.email }
      const options = { upsert: true }
      const updateDoc = { $set: user }

      const result = await usersCollection.updateOne(filter, updateDoc, options)
      res.json(result)
    })

    // admin
    app.put(`/users/admin`, verifyToken, async (req, res) => {
      const user = req.body
      const requester = req.decodedEmail

      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester
        })
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email }
          const updateDoc = { $set: { role: "admin" } }
          const result = await usersCollection.updateOne(filter, updateDoc)
          res.json(result)
        } else {
          res.status(403).json({ message: "You don not have access to Admin" })
        }
      }
    })
  } finally {
    // await client.close();
  }
}

run().catch(console.dir)

app.get("/", (req, res) => {
  res.send("Hello Doctors portal!")
})

app.listen(port, () => {
  console.log(`listening at ${port}`)
})

// app.get('/users')
// app.post('/users')
// app.get('/users/:id')
// app.put('/users/:id');
// app.delete('/users/:id')
// users: get
// users: post
