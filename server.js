// Assuming you already created and configured your Express app and HTTP server:
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const server = http.createServer(app);
const io     = require('socket.io')(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// ... your existing routes for signup/login, products, etc. ...

/* Chat logic */

// When a client connects, set up room handlers.
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a room (global or per‑store).  The roomId is sent by the client.
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    // Notify other users in the room (optional)
    socket.to(roomId).emit('message', {
      sender: 'System',
      content: 'A new user has joined the chat.',
      roomId,
    });
  });

  // Handle incoming chat messages.  Emit only to the specified room.
  socket.on('sendMessage', ({ roomId, content, token }) => {
    // TODO: validate the token and get user info if you enforce auth.
    const sender = 'Guest';
    io.to(roomId).emit('message', {
      sender,
      content,
      roomId,
    });
  });

  // Leave rooms automatically on disconnect (Socket.IO does this by default)
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
