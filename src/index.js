require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs").promises; // use async version
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"))
app.set("view engine", "ejs");

const BASE_URL = "https://api.cashfree.com/pg/orders"
  /*"https://api.cashfree.com/pg/orders//"https://sandbox.cashfree.com/pg";*/
const DATA_FILE = "data.json";
let add_count ;

// Utility to safely read data
const readData = async () => {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading data file:", err);
    return { number_of_order: 0 };
  }
};

// Utility to safely write data
const writeData = async (data) => {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing data file:", err);
  }
};

// Home route
app.get("/", (req, res) => {
  res.render("index");
});



app.get("/terms_and_condition", (req, res) => {
res.render("terms_and_condition");
});

app.get("/contact_us", (req, res) => {
  res.render("contact_us");
});



// Get order count
app.get("/order-count-MK", async (req, res) => {
  const data = await readData();
  res.json(data);
});

// Payment initiation
app.post("/payment", async (req, res) => {
  const { amount, email } = req.body;

  if (!amount || !email) {
    return res.status(400).json({ error: "Amount and Email are required" });
  }

  const count = await readData();
  const orderId = `ORDER_${count.number_of_order + 1}_${uuidv4()}`;
//console.log(count);
  const orderData = {
    order_id: orderId,
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: `CUST_${count.number_of_order + 1}`,
      customer_email: email,
      customer_phone: "9999999999",
      customer_name: "MK Supporter"
    }
  };

  try {
    const response = await axios.post(`${BASE_URL}/orders`, orderData, {
      headers: {
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CLIENT_ID,
        "x-client-secret": process.env.CLIENT_SECRET,
        "Content-Type": "application/json"
      }
    });

    // Update and store new order count
   add_count= count.number_of_order += 1;
    

    res.json({
      payment_session_id: response.data.payment_session_id,
      order_id: orderId
    });
  } catch (error) {
    console.error("Error creating order:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Payment verification
app.post("/verify", async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Order ID required" });
  }

  try {
    const response = await axios.get(`${BASE_URL}/orders/${orderId}`, {
      headers: {
        "x-api-version": "2022-01-01",
        "x-client-id": process.env.CLIENT_ID,
        "x-client-secret": process.env.CLIENT_SECRET
      }
    });

    const status = response.data.order_status;

    if (status === "PAID") {
 const count = {
    number_of_order: add_count
 }
    await writeData(count);     
      
      return res.json({ success: true, message: "Payment successful" });
    } else {
      return res.status(400).json({ success: false, message: "Payment processing", status });
    }
  } catch (error) {
    console.error("Verification failed:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
});