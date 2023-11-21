const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express()
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000


// middleWare
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d6oiejw.mongodb.net/?retryWrites=true&w=majority`;

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
       const menuCollection = client.db('bistroDb').collection('menu')
       const reviewsCollection = client.db('bistroDb').collection('reviews')
       const cartsCollection = client.db('bistroDb').collection('carts')
       const userCollection = client.db('bistroDb').collection('users')
       const paymentCollection = client.db('bistroDb').collection('payments')
        
       // jwt related api
       app.post('/jwt', async (req, res)=>{

          const user = req.body;
           const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{
             expiresIn:'3h'
           });
           res.send({token})
       }) 
        // middleWare verify token
        const verifyToken = (req, res, next)=>{
          console.log( 'inside verify token', req.headers.authorization);
           if(!req.headers.authorization){
               return res.status(401).send({message: 'unauthorized access'})
           }
           const token = req.headers.authorization.split(' ')[1]
             
          jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
              if(err){
                return res.status(401).send({message: 'unauthorized access'})
              }
              req.decoded = decoded
              next()
          })
        }
          //   use verify admin after verify token
        const verifyAdmin = async (req, res, next)=>{
            const email = req.decoded.email
            const query = {email: email};
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if(!isAdmin){
                return res.status(403).send({message: 'forbidden assess'})
            }

            next()

        }
        
      //  user related api
      //  get
      app.get('/users', verifyToken, verifyAdmin, async (req, res)=>{ 
          const result = await userCollection.find().toArray()
          res.send(result)
      })
      
      app.get('/users/admin/:email', verifyToken, async (req, res) =>{
            const email = req.params.email;
            if( email !== req.decoded.email){
              return res.status(403).send({message: 'forbidden assess'})
            }
            const query = {email: email};
            const user = await userCollection.findOne(query)
             let admin = false
             if(user){
                admin = user?.role === 'admin'
             }
             res.send({admin})
      })

      // delete api
      app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res)=>{
             const id = req.params.id;
             const query = { _id: new ObjectId(id)}
             const result = await userCollection.deleteOne(query)
             res.send(result)

      })

      // make admin api
      app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res)=>{
            
              const id = req.params.id;
              const filter = { _id: new ObjectId(id)}
              const updateDoc = {
                 $set:{
                    role:"admin"
                 }

              }
           const result = await userCollection.updateOne(filter, updateDoc)
           res.send(result);
      })

      // post
      app.post('/users', async (req, res)=>{
          const user = req.body;
          // insert email if user doset exists
          // simple checking
          const query = {email: user.email}
          const existingUser = await userCollection.findOne(query)
          if(existingUser){
            return res.send({message: 'user already exist', inserted: null})
          }
          const result = await userCollection.insertOne(user);
          res.send(result);
      })


        // menu
       app.get('/menu',async(req, res)=>{
           const result = await menuCollection.find().toArray()
           res.send(result)
       })

       app.patch('/menu/:id', async (req, res)=>{
            const item = req.body
            const id = req.params.id
            const filter = { _id: id }
            const updateDoc = {
                $set:{
                  name: item.name,
                  category: item.category,
                  price: item.price,
                  recipe:item.recipe,
                  image: item.image 
                }

            }
            const result = await menuCollection.updateOne(filter, updateDoc)
            res.send(result)
       })

       app.get('/menu/:id', async (req, res)=>{
             const id = req.params.id
             const query = {_id: id}   
            const result = await menuCollection.findOne(query)
            res.send(result)


       })

      app.post('/menu', verifyToken, verifyAdmin, async (req, res)=>{
            const item = req.body;
            const result = await menuCollection.insertOne(item)
            res.send(result)
      })

      app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res)=>{
            const id = req.params.id;
            const query = {_id: id}
            const result = await menuCollection.deleteOne(query);
            res.send(result)

      })

      //  reviews
       app.get('/reviews',async(req, res)=>{
           const result = await reviewsCollection.find().toArray()
           res.send(result)
       })
      //   carts collection
      app.post('/carts', async (req, res)=>{
         const cartItem = req.body;
         const result = await cartsCollection.insertOne(cartItem)
         res.send(result)
      })
      // get carts
      app.get('/carts', async (req, res)=>{
           const email = req.query.email
           const query = {email: email}
           const result = await cartsCollection.find(query).toArray()
           res.send(result)
      })
      // delete
      app.delete('/carts/:id', async (req, res)=>{
          const id = req.params.id
          const query = {_id: new ObjectId(id)}
          const result = await cartsCollection.deleteOne(query)
          res.send(result)
      })

      // payment intent
      app.post('/create-payment-intent', async (req, res)=>{
          const {price} = req.body
          const amount = parseInt (price * 100)
          console.log(amount, 'taka taka');
          const paymentIntent = await stripe.paymentIntents.create({
              amount: amount,
              currency: 'usd',
              payment_method_types:['card']
          })
          res.send({
            clientSecret: paymentIntent.client_secret
          })
      })
        // payment history api
        app.get('/payments/:email', verifyToken, async(req, res)=>{
             const query = {email: req.params.email}
             if(req.params.email !== req.decoded.email){
                return res.status(403).send({message: 'forbidden assess'})
             }
          const result = await paymentCollection.find(query).toArray()
           res.send(result)

        })


      app.post('/payments', async (req, res)=>{
          const payment = req.body
          const paymentResult = await paymentCollection.insertOne(payment)

          // carefully delete each item form the cart
          console.log('payment info', payment); 
          const query = {_id: {
              $in: payment.cartIds.map(id => new ObjectId(id))
          }}

          const deleteResult = await cartsCollection.deleteMany(query)

          res.send({paymentResult, deleteResult})

      })


      // stats or analytics

      app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res)=>{
          const users = await userCollection.estimatedDocumentCount();
          const menuItems = await menuCollection.estimatedDocumentCount();
          const orders = await paymentCollection.estimatedDocumentCount();
         
          const result = await paymentCollection.aggregate([
                 {
                  $group:{
                    _id:null,
                    totalRevenue:{
                      $sum:'$price'
                    }
                  }
                 } 
          ]).toArray();

          const revenue = result.length > 0 ? result[0].totalRevenue : 0;

          res.send({
            users,
            menuItems,
            orders,
            revenue
          })
      })

      //  using aggregate pipeline

      app.get('/order-stats', verifyToken, verifyAdmin, async (req, res)=>{
          const result = await paymentCollection.aggregate([
                  {
                    $unwind:'$menuItemIds'
                  },
                  {
                    $lookup:{
                      from:'menu',
                      localField:'menuItemIds',
                      foreignField:'_id',
                      as:'menuItems'
                    }
                  },
                  {
                    $unwind:'$menuItems'
                  },
                  {
                    $group:{
                      _id: '$menuItems.category',
                      quantity:{$sum: 1},
                      revenue:{ $sum: '$menuItems.price' }
                    }
                  },
                  {
                    $project:{
                      _id: 0,
                      category:'$_id',
                      quantity:'$quantity',
                      revenue: '$revenue'
                    }
                  }
          ]).toArray()

          res.send(result)
      })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res)=>{
    res.send('boss is running')
})

app.listen(port, ()=>{
    console.log(`resturant bistro server is run ${port}`)
})