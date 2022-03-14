require('dotenv').config()

const express = require('express')
const app = express()
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')

app.use(express.json())
app.use(cors())

// <MongoDB>
const url = process.env.ATLAS_URI

mongoose.connect(url, (err) => {
  if (err) return console.log(err)
  console.log('Connected to Database')
})

const chatSchema = new mongoose.Schema({
  author: String,
  message: String
})

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String
})

async function updateRoom(roomID, author, message) {
  const Chat = mongoose.model(roomID, chatSchema, roomID)

  const chat = new Chat({
    author: author,
    message: message
  })
  await chat.save()
}

async function addUser(username, email, password) {
  const User = mongoose.model('users', userSchema, 'users')

  const userExists = await User.findOne({ username })
  const emailExists = await User.findOne({ email })
  if(userExists) {
    return 'userExists'
  }
  if(emailExists) {
    return 'emailExists'
  }

  const user = new User({
    username,
    email,
    password
  })
  await user.save()
}

async function authenticateUser(username,  password) {
  const User = mongoose.model('users', userSchema, 'users')

  const userExists = await User.findOne({ username })
  if(!userExists) {
    return 'userNotFound'
  }
  console.log('foundUser:', userExists)
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


app.get('/posts', authenticateToken, (req, res) => {
  res.json(posts.filter(post => post.username === req.user.name))
})

app.post('/signup', async (req, res) => {
  // console.log(req.body)
  const response = await addUser(req.body.username, req.body.email, req.body.password)

  if(response === 'userExists') {
    res.status(208).send('User already exists, try another username')
    return
  }
  if(response === 'emailExists') {
    res.status(208).send('Email already registered')
    return
  }
  res.status(201).send('User added successfully')
})

function authenticateToken(req, res, next) {
  // Bearer TOKEN
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    // Invalid Token
    if (err) return res.sendStatus(403)
    // Valid Token
    req.user = user
    next()
  })
}

app.post('/login', async (req, res) => {
  // Authenticate User
  await authenticateUser(req.body.username, req.body.password)


  // const username = req.body.username
  // const user = { name: username }

  // const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET)
  // res.json({ accessToken: accessToken })
})

// Creating server with cors 
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  }
})

// <Socket>
io.on('connection', (socket) => {
  console.log(socket.id, 'has Connected');

  socket.on('join_room', (roomID) => {
    socket.join(roomID)
    console.log(socket.id, 'joined room', roomID);
  })

  socket.on('send_message', (data) => {
    const roomID = data.room
    const message = data.message
    const author = data.author
    socket.to(roomID).emit('receive_message', data)

    updateRoom(roomID, author, message)
  })

  socket.on('disconnect', () => {
    console.log(socket.id, 'has Disconnected');
  })
})
// </Socket>


server.listen(3001, () => console.log('SERVER RUNNING'));