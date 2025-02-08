const express = require("express")
const mysql = require("mysql2")
const cors = require("cors")
require("dotenv").config()

const app = express()
app.use(cors())
app.use(express.json())

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: {
    rejectUnauthorized: false,
  },
})

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err)
    return
  }
  console.log("Connected to the database")
})

const menuOptions = [
  { id: 1, text: "Información sobre nuestros servicios", keyword: "servicios" },
  { id: 2, text: "Solicitar una cotización", keyword: "cotizar" },
  { id: 3, text: "Contactar con nosotros", keyword: "contacto" },
  { id: 4, text: "Conocer más sobre Nexwey Services", keyword: "nexwey" },
]

// Función para guardar el mensaje del usuario
const saveUserMessage = (message) => {
  return new Promise((resolve, reject) => {
    const query = "INSERT INTO user_messages (message) VALUES (?)"
    db.query(query, [message], (err, result) => {
      if (err) {
        console.error("Error al guardar el mensaje del usuario:", err)
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

// Función para obtener respuesta basada en palabras clave
const getResponse = (message) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT DISTINCT kb.* 
      FROM knowledge_base kb
      JOIN keywords k ON kb.id = k.knowledge_id
      WHERE LOWER(?) LIKE CONCAT('%', LOWER(k.keyword), '%')
    `

    db.query(query, [message], (err, results) => {
      if (err) {
        reject(err)
        return
      }

      if (results.length > 0) {
        // Formatea el contenido para incluir saltos de línea
        let formattedContent = results[0].content.replace(/\\r\\n/g, "\n")
        formattedContent = formattedContent.replace(/\\n/g, "\n")
        resolve(formattedContent)
      } else {
        resolve("Lo siento, no tengo información sobre eso. ¿Puedo ayudarte con algo más?")
      }
    })
  })
}

// Ruta para el chat
app.post("/api/chat", async (req, res) => {
  const { message } = req.body

  try {
    // Guardar el mensaje del usuario
    await saveUserMessage(message)

    let response

    if (message.toLowerCase() === "menu" || message === "0") {
      const menuText = menuOptions.map((option) => `${option.id}. ${option.text}`).join("\n")
      response = `Estas son las opciones disponibles:\n${menuText}\n\nPuedes seleccionar una opción escribiendo el número o el texto correspondiente.`
    } else {
      const menuOption = menuOptions.find(
        (option) => option.id.toString() === message || message.toLowerCase().includes(option.keyword),
      )

      if (menuOption) {
        if (menuOption.keyword === "cotizar") {
          response =
            "Para proporcionarte una cotización, necesito algunos datos. Por favor, proporciona la siguiente información:\n1. Nombre completo\n2. Correo electrónico\n3. Teléfono\n4. Descripción breve del proyecto"
        } else {
          response = await getResponse(menuOption.keyword)
        }
      } else {
        response = await getResponse(message)
      }
    }

    res.json({ response })
  } catch (error) {
    console.error("Error en el servidor:", error)
    res.status(500).json({ error: "Error en el servidor" })
  }
})

// Ruta para manejar las cotizaciones
app.post("/api/quote", (req, res) => {
  const { name, email, phone, description } = req.body
  const requestDate = new Date().toISOString().slice(0, 19).replace("T", " ")

  const query = `
    INSERT INTO quote_requests (name, email, phone, description, request_date)
    VALUES (?, ?, ?, ?, ?)
  `

  db.query(query, [name, email, phone, description, requestDate], (err, result) => {
    if (err) {
      res.status(500).json({ error: "Error al guardar la solicitud de cotización" })
      return
    }

    res.json({ message: "Solicitud de cotización recibida. Un representante se pondrá en contacto contigo pronto." })
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

