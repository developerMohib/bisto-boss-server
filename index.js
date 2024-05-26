const express = require('express') ;
const cors = require('cors') ;
const app = express() ;
require('dotenv').config();
const port = process.env.PORT || 5000 ;

// middleware
app.use(cors());
app.use(express.json()) ;

// mongo db connection

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ylmjbhk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
        // Get the database and collection
        const database = client.db("bistoDB");

        const menuColl = database.collection("menuCollection");
        const reviewCollection = database.collection("reviewCollection");
        const cartCollection = database.collection("cartsCollection");
        const userCollection = database.collection("usersCollection");

        // user collection data added
        app.post('/users', async (req, res) => {
          const user = req.body ;
          const result = await userCollection.insertOne(user) ;
          res.send(result)
        })

        // menu collection data read 
        app.get('/menu', async (req, res) => {
            const result = await menuColl.find().toArray(); 
            res.send(result) ;
        })

        // review collection data read 
        app.get('/review', async (req, res) => {
            const cursor = reviewCollection.find() ;
            const result = await cursor.toArray() ;
            res.send(result)
        })

        // carts collection data 
        app.get('/carts', async(req, res)=> {
          const email = req?.query.email ;
          const query = { email: email }
          const cursor = cartCollection.find(query) ;
          const result = await cursor.toArray() ;
          res.send(result)
        })
        app.post('/carts', async (req, res) => {
          const cartItem = req.body ;
          const result = await cartCollection.insertOne(cartItem) ;
          res.send(result)
        })

        // delete from cart 
        app.delete('/carts/:id', async (req, res) => {
          const id = req.params.id ;
          const query = {_id : new ObjectId(id)};
          const result = await cartCollection.deleteOne(query);
          res.send(result)
        } )

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('bisto boss is comming')
})
app.listen(port, ()=> {
    console.log(`bisto boss port is ${port}`)
})