const { WebSocketServer, WebSocket } = require("ws");
const jwt = require("jsonwebtoken");

const WS_PATH = process.env.WS_PATH || "/ws";
const JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function createNoopHub() {
  return {
    wss: null,
    getStats() {
      return {
        totalClients: 0,
        authenticatedClients: 0,
      };
    },
    sendToSocket() {},
    sendToOpenid() {},
    broadcastToConversation() {},
    notifyConversationParticipants() {},
  };
}

const webSocketHub = createNoopHub();

function initWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: WS_PATH });
  const clientsByOpenid = new Map();

  function sendToSocket(socket, payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }

  function addClient(openid, socket) {
    if (!openid) {
      return;
    }
    if (!clientsByOpenid.has(openid)) {
      clientsByOpenid.set(openid, new Set());
    }
    clientsByOpenid.get(openid).add(socket);
  }

  function removeClient(openid, socket) {
    if (!openid || !clientsByOpenid.has(openid)) {
      return;
    }
    const sockets = clientsByOpenid.get(openid);
    sockets.delete(socket);
    if (!sockets.size) {
      clientsByOpenid.delete(openid);
    }
  }

  function sendToOpenid(openid, payload) {
    const sockets = clientsByOpenid.get(openid);
    if (!sockets || !sockets.size) {
      return 0;
    }

    let sent = 0;
    sockets.forEach((socket) => {
      if (sendToSocket(socket, payload)) {
        sent += 1;
      }
    });
    return sent;
  }

  function broadcastToConversation(conversationId, payload) {
    let sent = 0;
    wss.clients.forEach((socket) => {
      if (
        socket.readyState === WebSocket.OPEN &&
        socket.subscriptions instanceof Set &&
        socket.subscriptions.has(conversationId)
      ) {
        socket.send(JSON.stringify(payload));
        sent += 1;
      }
    });
    return sent;
  }

  function notifyConversationParticipants(conversation, payload) {
    const openids = Array.from(
      new Set([conversation?.buyer_openid, conversation?.seller_openid].filter(Boolean)),
    );
    const conversationIds = Array.from(
      new Set([conversation?.id, conversation?._id].filter(Boolean).map((item) => String(item))),
    );

    let sent = 0;
    openids.forEach((openid) => {
      sent += sendToOpenid(openid, payload);
    });
    conversationIds.forEach((conversationId) => {
      sent += broadcastToConversation(conversationId, payload);
    });
    return sent;
  }

  Object.assign(webSocketHub, {
    wss,
    getStats() {
      let authenticatedClients = 0;
      wss.clients.forEach((socket) => {
        if (socket.user?.openid) {
          authenticatedClients += 1;
        }
      });
      return {
        totalClients: wss.clients.size,
        authenticatedClients,
      };
    },
    sendToSocket,
    sendToOpenid,
    broadcastToConversation,
    notifyConversationParticipants,
  });

  wss.on("connection", (socket, request) => {
    socket.isAlive = true;
    socket.subscriptions = new Set();
    socket.user = null;

    const requestUrl = new URL(request.url, "http://localhost");
    const token = requestUrl.searchParams.get("token");

    if (!token) {
      sendToSocket(socket, {
        type: "auth:error",
        message: "Missing token.",
      });
      socket.close(1008, "Missing token");
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = {
        id: decoded.sub || "",
        openid: decoded.openid || "",
        role: decoded.role || "user",
      };
      addClient(socket.user.openid, socket);
      sendToSocket(socket, {
        type: "auth:success",
        data: {
          openid: socket.user.openid,
          role: socket.user.role,
        },
      });
    } catch (error) {
      sendToSocket(socket, {
        type: "auth:error",
        message: "Invalid token.",
      });
      socket.close(1008, "Invalid token");
      return;
    }

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (raw) => {
      const payload = safeJsonParse(String(raw || ""));
      if (!payload || typeof payload !== "object") {
        sendToSocket(socket, {
          type: "error",
          message: "Invalid payload.",
        });
        return;
      }

      if (payload.type === "ping") {
        sendToSocket(socket, {
          type: "pong",
          ts: Date.now(),
        });
        return;
      }

      if (payload.type === "subscribe" && payload.conversationId) {
        socket.subscriptions.add(String(payload.conversationId));
        sendToSocket(socket, {
          type: "subscribe:success",
          data: {
            conversationId: String(payload.conversationId),
          },
        });
        return;
      }

      if (payload.type === "unsubscribe" && payload.conversationId) {
        socket.subscriptions.delete(String(payload.conversationId));
        sendToSocket(socket, {
          type: "unsubscribe:success",
          data: {
            conversationId: String(payload.conversationId),
          },
        });
        return;
      }

      sendToSocket(socket, {
        type: "error",
        message: "Unsupported message type.",
      });
    });

    socket.on("close", () => {
      removeClient(socket.user?.openid, socket);
    });

    socket.on("error", (error) => {
      console.error("[ws] client error:", error.message);
    });
  });

  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (!socket.isAlive) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatTimer);
  });

  console.log(`[ws] WebSocket server listening on ${WS_PATH}`);
  return webSocketHub;
}

module.exports = {
  initWebSocketServer,
  webSocketHub,
  WS_PATH,
};
