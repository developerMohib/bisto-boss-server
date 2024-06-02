const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_SK)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// mongo db connection

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ylmjbhk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // Get the database and collection
    const database = client.db("bistoDB");

    const menuColl = database.collection("menuCollection");
    const cartCollection = database.collection("cartsCollection");
    const userCollection = database.collection("usersCollection");
    const reviewCollection = database.collection("reviewCollection");
    const paymentCollection = database.collection("paymentCollection");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "4h",
      });
      res.send({ token });
    });

    // middle-wares
    const verifyToken = (req, res, next) => {
      // console.log("inside the get ", req.headers.authorization);
      const token = req.headers.authorization;
      // if user token is none
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      // if user token get but not match
      const splitToken = token.split(" ")[1];
      if (!splitToken) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      // token verify
      jwt.verify(
        splitToken,
        process.env.ACCESS_TOKEN_SECRET,
        (err, decoded) => {
          if (err) {
            // taile kicu koro
            return res
              .status(401)
              .send({ message: "unauthorized access" });
          }
          // else decoded
          else {
            req.decoded = decoded;
            next();
          }
        }
      );
    };

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // user admin create and verifying
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const userEmail = req.params.email;
      // you post your email when you post jwt from auth provider
      const decodedEmail = req.decoded.email;
      // if these are same then it's admin
      if (userEmail !== decodedEmail) {
        // make him / her Admin
        return res.status(401).send({ message: "unauthorized access" });
      }
      // 
      const query = { email: decodedEmail };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    // get some estimate count 
    app.get('/admin-states',verifyToken, verifyAdmin, async(req,res)=>{
      const estimateUser = await userCollection.estimatedDocumentCount() ;
      const estimateOrder = await paymentCollection.estimatedDocumentCount() ;
      const estimateItem = await menuColl.estimatedDocumentCount() ;
      const result = await paymentCollection.aggregate([
        {
          $group : {
            _id : null , revenue : { $sum : '$price' }
          }
        }
      ]).toArray() ;
      const revenue = result.length > 0 ? result[0].revenue : 0 ;

      res.send({
        estimateUser,estimateOrder,estimateItem, revenue
      })
    })

    // user collection get
    app.get("/users",verifyToken,verifyAdmin, async (req, res) => {
      const allUser = userCollection.find();
      const result = await allUser.toArray();
      res.send(result);
    });

    // user collection data added
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const exitEmail = await userCollection.findOne(query);
      if (exitEmail) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // menu collection data read
    app.get("/menu", async (req, res) => {
      const cursor = menuColl.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // menu data post to database 
    app.post("/menu",verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body ;
      const result = await menuColl.insertOne(item);
      res.send(result)
    })

    // menu item delete 
    app.delete('/menu/:id',verifyToken,verifyAdmin, async (req, res)=> {
      // looking for body or from ui
      const id = req.params.id ;
      // looking for database 
      const query = {_id : new ObjectId(id)}
      console.log(query, 'menu id delete')
      const result = await menuColl.deleteOne(query)
      res.send(result)
    })

    // review collection data read
    app.get("/review", async (req, res) => {
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    }); 

    // carts collection data
    app.get("/carts", async (req, res) => {
      const email = req?.query.email;
      const query = { email: email };
      const cursor = cartCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // cart collection data post
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // payment history geting
    app.get('/confirmd-order/:email', verifyToken, async (req, res) => {
      const paramsEmail = req.params?.email ;
      const query = {email: paramsEmail}
      const decodedEmail = req?.decoded?.email ;
      console.log(decodedEmail,'decoded email')
      if(paramsEmail !== decodedEmail){
        return res.status(403).send({massage:'forbiden access'})
      }
      const result = await paymentCollection.find().toArray();
      res.send(result)
    })

    // payment order 
    app.post('/confirmd-order', async (req, res) => {
      const cartItem = req.body ;
      const result = await paymentCollection.insertOne(cartItem);
      const query = { _id : {
        $in: cartItem.cartId.map(id => new ObjectId(id))
      }}
      const newResult = await cartCollection.deleteMany(query);
      res.send({result, newResult})
    })

    // update role
    app.patch("/users/admin/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // create payment intent
    app.post('/create-payment-intent', async(req, res) => {
      const {price} = req.body ;
      const amount = parseInt(price * 100) ;

      // payment intent with count and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount ,
        currency: "usd",
        payment_method_types: [
          "card",
        ],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // delete user
    app.delete("/users/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    // delete from cart
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("bisto boss is comming");
});
app.listen(port, () => {
  console.log(`bisto boss port is ${port}`);
});
