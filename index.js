const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("./models/User");
const cookieParser = require("cookie-parser");
const imageDownloader = require("image-downloader");
const Place = require("./models/Place");
const multer = require("multer");
const fs = require("fs");
const { get } = require("http");
const BookingModel = require("./models/Booking");
const { resolve } = require("path");
require("dotenv").config();

const app = express();

// encryption
const bcryptSalt = bcrypt.genSaltSync(10);

const jwtsecret = "djashjandjajkdnadjdan";

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(
  cors({
    credentials: true,
    origin: "https://airbnc-one.vercel.app/",
  })
);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

//common function for getting userdata

function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtsecret, {}, (err, userData) => {
      if (err) {
        reject(err);
      } else {
        resolve(userData);
      }
    });
  });
}

// Endpoint for the '/test' URL
app.get("/test", (req, res) => {
  res.json("test okay shannu"); // Sending JSON response for '/test' endpoint
});

// Registration endpoint
// Registration endpoint
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userDoc = await UserModel.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    console.error("Registration error:", e); // Log the error
    res.status(422).json({
      error: "Registration Failed. Please try again Later",
      details: e.message,
    });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const userDoc = await UserModel.findOne({ email });

  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);

    if (passOk) {
      jwt.sign(
        { email: userDoc.email, id: userDoc._id },
        jwtsecret,
        {},
        (err, token) => {
          if (err) throw err;
          res.cookie("token", token).json(userDoc);
        }
      );
    } else {
      res.status(422).json("Invalid password");
    }
  } else {
    res.status(404).json("User not found");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtsecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await UserModel.findById(userData.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});
//logout

app.post("/logout", (req, res) => {
  res.cookie("token", "").json(true);
});

// end point for URL link uploads -/upload-by-link
app.post("/upload-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  await imageDownloader.image({
    url: link,
    dest: __dirname + "/uploads/" + newName, // Added a forward slash before newName
  });
  res.json(newName); // Return only the filename instead of the full path
});

// Multer configuration for uploading images
const photosMiddleware = multer({ dest: "uploads" });

// Upload photo endpoint
// Upload photo endpoint
app.post("/upload", photosMiddleware.array("photos", 100), (req, res) => {
  const uploadFiles = req.files.map((file) => {
    const ext = file.originalname.split(".").pop();
    const newPath = `${file.path}.${ext}`;
    fs.renameSync(file.path, newPath);
    return newPath.replace("uploads/", ""); // Returning relative path
  });
  res.json(uploadFiles);
});

// adding,saving places to DB endpoint
app.post("/places", (req, res) => {
  const { token } = req.cookies;
  const {
    title,
    address,
    photos: addedphotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;
  // grabbing userID
  jwt.verify(token, jwtsecret, {}, async (err, userData) => {
    if (err) {
      console.error("JWT verification error:", err);
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const placeDoc = await Place.create({
        owner: userData.id,
        title,
        address,
        photos: addedphotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      res.json(placeDoc);
    } catch (error) {
      console.error("Error creating place:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

// grabbing places in places pages

app.get("/user-places", (req, res) => {
  const { token } = req.cookies;
  // getting userid - decryption
  jwt.verify(token, jwtsecret, {}, async (err, userData) => {
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

//places and id
app.get("/places/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const place = await Place.findById(id);
    if (!place) {
      return res.status(404).json({ error: "Place not found" });
    }
    res.json(place);
  } catch (error) {
    console.error("Error fetching place:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/places", async (req, res) => {
  // const {id} =req.params
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    photos: addedphotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  // getting userId and usinf it
  jwt.verify(token, jwtsecret, {}, async (err, userData) => {
    if (err) throw err;

    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedphotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.json("ok");
    }
  });
});

app.get("/places", async (req, res) => {
  res.json(await Place.find());
});
// in place of await async .then can be the alternative
// booking

app.post("/bookings", async (req, res) => {
  const userData = await getUserDataFromRequest(req);
  const { place, checkIn, checkOut, numberOfGuests, names, phone, price } =
    req.body;

  // Creating the booking inside the callback function to ensure access to variables
  BookingModel.create({
    place,
    checkIn,
    checkOut,
    numberOfGuests,
    names,
    phone,
    price,
    user: userData.id,
  })
    .then((doc) => {
      res.json(doc);
    })
    .catch((err) => {
      console.error("Error creating booking:", err);
      res.status(500).json({ error: "Internal Server Error" });
    });
});

// grab bookings

app.get("/bookings", async (req, res) => {
  const userData = await getUserDataFromRequest(req);
  res.json(await BookingModel.find({ user: userData.id }).populate("place"));
});

// Start server
const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
