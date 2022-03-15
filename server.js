require('dotenv').config()

const express = require('express')
const app = express()
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { json } = require('body-parser')

app.use(express.json())
app.use(cors())

// <MongoDB>
const url = process.env.ATLAS_URI

mongoose.connect(url, (err) => {
  if (err) return console.log(err)
  console.log('Connected to Database')
})

const connection = mongoose.connection;

const chatSchema = new mongoose.Schema({
  author: String,
  message: String,
  roomID: String,
  time: String
})

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String
})

async function updateRoom(roomID, author, message, time) {
  const Chat = mongoose.model(roomID, chatSchema, roomID)

  const chat = new Chat({
    author: author,
    message: message,
    roomID: roomID,
    time: time
  })
  await chat.save()
}

async function addUser(username, email, password) {
  const User = mongoose.model('users', userSchema, 'users')

  const userExists = await User.findOne({ username })
  const emailExists = await User.findOne({ email })
  if (userExists) {
    return 'userExists'
  }
  if (emailExists) {
    return 'emailExists'
  }

  const user = new User({
    username,
    email,
    password
  })
  await user.save()
}

async function authenticateUser(username, password) {
  const User = mongoose.model('users', userSchema, 'users')

  const userDetails = await User.findOne({ username })
  if (!userDetails) {
    return 'userNotFound'
  }
  if (userDetails.password !== password) {
    return 'wrongPassword'
  }
  return 'successful'
}
// </MongoDB>

const posts = [
  {
    username: 'Kyle',
    title: 'Post 1'
  },
  {
    username: 'Jim',
    title: 'Post 2'
  }
]

app.post('/signup', async (req, res) => {
  console.log('singed-up:', req.body)
  const response = await addUser(req.body.username, req.body.email, req.body.password)

  if (response === 'userExists') {
    return res.status(208).send('User already exists, try another username')
  }
  if (response === 'emailExists') {
    return res.status(208).send('Email already registered')
  }
  res.status(201).send('User added successfully')
})

app.post('/login', async (req, res) => {
  // Authenticate User
  const loginMessage = await authenticateUser(req.body.username, req.body.password)

  if (loginMessage === 'userNotFound') {
    return res.status(400).send('Signup to use the Chat')
  }
  if (loginMessage === 'wrongPassword') {
    return res.status(400).send('Incorrect password')
  }

  console.log('Logged-in:', req.body)

  const username = req.body.username
  const user = { name: username }

  const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET)
  res.json({ accessToken: accessToken })
})

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  }
})

// <Socket>
io.use(function (socket, next) {
  if (socket.handshake.query && socket.handshake.query.token) {
    jwt.verify(socket.handshake.query.token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
      if (err) return next(new Error('Authentication error'));
      socket.decoded = decoded;
      next();
    });
  }
  else {
    next(new Error('Authentication error'));
  }
})
  .on('connection', (socket) => {
    console.log(socket.id, 'has Connected');

    socket.on('join_room', async (roomID) => {
      socket.join(roomID)
      console.log(socket.id, 'joined room', roomID);

      var coll = connection.collection(roomID)
      await coll.find({}).toArray(function (err, result) {
        if (err) {
          console.log('err:', err)
        } else {
          socket.emit('receive_old_messages', result)
        }
      })

      socket.on('send_message', (data) => {
        const roomID = data.room
        const message = data.message
        const author = data.author
        const time = data.time
        socket.to(roomID).emit('receive_message', data)

        updateRoom(roomID, author, message, time)
      })

      socket.on('disconnect', () => {
        console.log(socket.id, 'has Disconnected');
      })
    })
  })
// </Socket>   


server.listen(3001, () => console.log('SERVER RUNNING'));

// function authenticateToken(req, res, next) {
//   // Bearer TOKEN
//   const authHeader = req.headers['authorization']
//   const token = authHeader && authHeader.split(' ')[1]

//   if (token == null) return res.sendStatus(401)

//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
//     // Invalid Token
//     if (err) return res.sendStatus(403)
//     // Valid Token
//     req.user = user
//     next()
//   })
// }
