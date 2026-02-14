// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // We will put html in a 'public' folder

// Track users: { socketId: { username, room, peerId } }
let users = {};

io.on('connection', (socket) => {
    
    // 1. User Connects
    socket.on('join-app', ({ username, peerId }) => {
        users[socket.id] = { username, room: null, peerId };
        console.log(`New user: ${username} (${peerId})`);
    });

    // 2. Join Voice Room
    socket.on('join-room', (roomName) => {
        const user = users[socket.id];
        if (!user) return;

        // Leave old room
        if (user.room) socket.leave(user.room);
        
        // Join new
        user.room = roomName;
        socket.join(roomName);

        // Tell the user who is already there (so we can call them)
        const usersInRoom = [];
        const sockets = io.sockets.adapter.rooms.get(roomName);
        if(sockets){
            sockets.forEach(sockId => {
                if(sockId !== socket.id && users[sockId]) {
                    usersInRoom.push({
                        id: sockId,
                        peerId: users[sockId].peerId,
                        username: users[sockId].username
                    });
                }
            });
        }
        
        socket.emit('room-users', usersInRoom);

        // Tell others a new peer joined
        socket.to(roomName).emit('user-connected', {
            id: socket.id,
            peerId: user.peerId,
            username: user.username
        });
    });

    // 3. Handle Disconnect
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user && user.room) {
            socket.to(user.room).emit('user-disconnected', user.peerId);
        }
        delete users[socket.id];
    });

    // 4. Chat
    socket.on('chat-msg', (msg) => {
        const user = users[socket.id];
        if(user) io.emit('new-chat', { user: user.username, text: msg });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Orbit Server running on port ${PORT}`);
});