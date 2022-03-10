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

mongoose.connect(url)

const db = mongoose.connection;

db.on('error', () => console.log('couldnt connect to database'))
db.once('connected', () => console.log('connected to database'))

const chatSchema = mongoose.Schema({
  author: String,
  message: String
})

function updateDatabase(roomID, author, message) {
  const chatModel = mongoose.model(roomID, chatSchema)

  const doc = new chatModel({
    author: author,
    message: message
  })

  db.collection(roomID).insertOne(doc)
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

app.post('/login', (req, res) => {
  // Authenticate User

  const username = req.body.username
  const user = { name: username }

  const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET)
  res.json({ accessToken: accessToken })
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

const server = http.createServer(app);

// <Socket>
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  }
})

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

    updateDatabase(roomID, author, message)
  })

  socket.on('disconnect', () => {
    console.log(socket.id, 'has Disconnected');
  })
})
// </Socket>


server.listen(3001, () => console.log('SERVER RUNNING'));