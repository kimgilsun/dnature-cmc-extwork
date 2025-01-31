"use server"

import mqtt from "mqtt"

let client: mqtt.Client | null = null

export async function connectMQTT() {
  if (!client) {
    client = mqtt.connect("wss://api.codingpen.com:8884", {
      username: "dnature",
      password: "XihQ2Q%RaS9u#Z3g",
      protocol: "wss",
      rejectUnauthorized: false, // 자체 서명된 인증서를 사용하는 경우
    })

    client.on("connect", () => {
      console.log("Connected to MQTT broker")
    })

    client.on("error", (err) => {
      console.error("MQTT error:", err)
    })
  }
  return true
}

export async function publishMessage(topic: string, message: string) {
  if (!client) {
    await connectMQTT()
  }

  client?.publish(topic, message)
  return true
}

export async function subscribeTopic(topic: string) {
  if (!client) {
    await connectMQTT()
  }

  client?.subscribe(topic)
  return true
}

