import { WebSocketServer } from "ws"
import { NextResponse } from "next/server";
import mqtt from "mqtt"

const wss = new WebSocketServer({ port: 3000 })
const mqttClient = mqtt.connect("wss://api.codingpen.com:8884", {
  username: "dnature",
  password: "XihQ2Q%RaS9u#Z3g",
  protocol: "wss",
  rejectUnauthorized: false,
})

mqttClient.on("message", (topic, message) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          topic,
          message: message.toString(),
        }),
      )
    }
  })
})

export async function GET() {
  return NextResponse.json({ status: "MQTT Connected" });
}

