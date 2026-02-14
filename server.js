const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Allow connections from anywhere
});

app.use(express.static('public'));

// Store User State: { socketId: { username, room, peerId } }
let users = {};

io.on('connection', (socket) => {
    
    // 1. Setup User
    socket.on('join-app', ({ username, peerId }) => {
        users[socket.id] = { username, room: null, peerId };
        console.log(`User registered: ${username} (${peerId})`);
    });

    // 2. Join Room
    socket.on('join-room', (roomName) => {
        const user = users[socket.id];
        if (!user) return;

        // If already in a room, leave it first
        if (user.room) {
            socket.leave(user.room);
            // Tell previous room we left
            socket.to(user.room).emit('user-disconnected', user.peerId);
        }

        user.room = roomName;
        socket.join(roomName);
        console.log(`${user.username} joined ${roomName}`);

        // Send existing users to the new guy
        const usersInRoom = [];
        const sockets = io.sockets.adapter.rooms.get(roomName);
        if(sockets){
            sockets.forEach(sockId => {
                if(sockId !== socket.id && users[sockId]) {
                    usersInRoom.push({
                        peerId: users[sockId].peerId,
                        username: users[sockId].username
                    });
                }
            });
        }
        socket.emit('room-users', usersInRoom);

        // Tell everyone else a new guy is here
        socket.to(roomName).emit('user-connected', {
            peerId: user.peerId,
            username: user.username
        });
    });

    // 3. Explicit Leave (Clicking Disconnect)
    socket.on('leave-room', () => {
        const user = users[socket.id];
        if (user && user.room) {
            console.log(`${user.username} left ${user.room}`);
            socket.to(user.room).emit('user-disconnected', user.peerId);
            socket.leave(user.room);
            user.room = null;
        }
    });

    // 4. Unexpected Disconnect (Closing Tab)
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user && user.room) {
            socket.to(user.room).emit('user-disconnected', user.peerId);
        }
        delete users[socket.id];
    });

    // Chat
    socket.on('chat-msg', (msg) => {
        const user = users[socket.id];
        if(user) io.emit('new-chat', { user: user.username, text: msg });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));