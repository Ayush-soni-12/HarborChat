const asyncHandler = require("../middlewares/asyncHandler");
const Contact = require("../modals/contactModal");
const User = require("../modals/UserModal");
const { cloudinary } = require("../ cloudConfig");
const { sendMail } = require("../Helpers/mailer");
const Message = require("../modals/Message");
const client = require("../redisClient.js");
// const generateToken = require("../middlewares/generateToken");
const jwt = require("jsonwebtoken");

module.exports.index = asyncHandler(async (req, res) => {
  return res.render("home.ejs");
});
module.exports.chat = asyncHandler(async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user._id })
      .sort({ messageTime: -1 }) // 🔥 Sort latest messageTime first
      .populate("contactId", "about")
 const contactsWithLastMsg = await Promise.all(
      contacts.map(async (contact) => {
        const lastMsg = await Message.findOne({
          $or: [
            { senderId: req.user._id, receiverId: contact.contactId._id },
            { senderId: contact.contactId._id, receiverId: req.user._id }
          ]
        })
          .sort({ timestamp: -1 })
          .lean();

        // Attach lastMessage (or empty string if none)
        return {
          ...contact.toObject(),
          lastMessage: lastMsg ? lastMsg.message : ""
        };
      })
    );

    res.render("chatss", { contacts: contactsWithLastMsg });
  } catch (err) {
    console.error(err);
    res.render("chatss", { contacts: [] });
  }
});
module.exports.contact = asyncHandler(async (req, res) => {
  try {
    let { name, phone } = req.body;
    console.log(req.body);

    if (!name || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "Name and phone are required." });
    }

    phone = phone.trim(); // Remove any whitespace first

    if (!phone.startsWith("+91")) {
      phone = "+91" + phone;
    }
    console.log(req.body);

    // Check if contact is a registered user
    const registeredUser = await User.findOne({ phoneNo: phone });

    console.log("resgisterUser", registeredUser);
    if (!registeredUser) {
      return res.status(404).json({
        success: false,
        message: "Contact is not registered on the platform.",
      });
    }

    // Check if this contact already exists for the current user
    const existingContact = await Contact.findOne({
      userId: req.user._id,
      phone,
    });
    if (existingContact) {
      return res
        .status(409)
        .json({ success: false, message: "Contact already exists." });
    }

    // Save new contact
    const contact = new Contact({
      name,
      phone,
      contactId: registeredUser._id,
      userId: req.user._id,
    });
    console.log(contact);

    await contact.save();

    res.status(201).json({ success: true, contact });
  } catch (err) {
    console.error("Error adding contact:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports.setting = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.send("User not exist");
  }
  const userDetail = req.user;
  // console.log(userDetail)
  return res.render("setting.ejs", { userDetail });
});

module.exports.Status = asyncHandler(async (req, res) => {
  return res.render("status.ejs");
});
module.exports.profile = asyncHandler(async (req, res) => {
  return res.render("profile.ejs");
});
module.exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, about } = req.body;
  const data = { name, about };
  const user_id = req.user._id;

  const oldUser = await User.findById(user_id);
  // console.log(oldUser.image_id)
  // console.log(req.file)

  if (req.file) {
    if (oldUser && oldUser.image_id) {
      // console.log("Deleting:", oldUser.image_id);
      await cloudinary.uploader.destroy(oldUser.image_id);
    } else {
      console.log("No old image to delete.");
    }

    // Add new image info
    data.image = req.file.path; // Cloudinary URL
    data.image_id = req.file.filename; // Cloudinary public_id
    // console.log(data.image_id)
    // console.log(data)
  }

  const updatedData = await User.findByIdAndUpdate(user_id, data, {
    new: true,
  });

  // return res.status(200).json({
  //   message: "Profile updated successfully",
  //   imageUrl: updatedData.image
  // });
  return res.redirect("/chat/setting");
});

module.exports.updateEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const userExist = await User.findOne({ email });
  // console.log(userExist)

  if (userExist) {
    return res.send("Email already exist");
  }

  const userdata = req.user;
  const userId = req.user._id;

  const token = jwt.sign({ userId, email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  const msg = `
  <p>Hi <strong>${userdata.name}</strong>,</p>
  <p>We received a request to change your email address on HarborChat.</p>
  <p>To confirm this change, please click the link below:</p>
  <p><a href="http://localhost:3000/auth/verifyemail?token=${token}" style="background-color:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Verify Email Address</a></p>
  <p>If you did not request this change, you can safely ignore this email.</p>
  <p>Thanks,<br>The HarborChat Team</p>
`;

  await sendMail(email, "Email change", msg);

  return res.redirect("/chat/setting");
});

module.exports.verifyEmailChange = asyncHandler(async (req, res) => {
  const { token } = req.query;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { userId, email } = decoded;
    console.log(decoded);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        email: email,
      },
      { new: true }
    );
    console.log(updatedUser);

    res.send("✅ Email successfully updated!");
  } catch (err) {
    console.log(err);
    res.status(400).send("❌ Invalid or expired token.");
  }
});

module.exports.me = asyncHandler(async (req, res) => {
  const user = req.user;
  console.log(req.user);
  return res.json({ user });
});
module.exports.personalChat = asyncHandler(async (req, res) => {
  try {
    const senderId = req.user._id.toString(); // from JWT
    const receiverId = req.params.receiverId;

    const ids = [senderId, receiverId].sort(); // consistent cache key
    const cacheKey = `chat:${ids[0]}:${ids[1]}`;

    const { skip = 0, limit = 30 } = req.query;

    // ✅ 1. Check Redis cache
    if (Number(skip) === 0) {
      const cached = await client.get(cacheKey);
      if (cached) {
        console.log("✅ Redis cache hit");
        return res.json({ messages: JSON.parse(cached) });
      }
    }

    // ❌ 2. Redis miss → Load from MongoDB
    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    })
      .sort({ timestamp: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const result = messages.reverse(); // oldest to newest for UI
    console.log("mongodb hit");

    // ✅ 3. Store only the first page in Redis
    if (Number(skip) === 0) {
      await client.set(cacheKey, JSON.stringify(result), { EX: 300 }); // 1 min cache
      console.log("💾 Cached first page to Redis");
    }

    return res.json({ messages: result });
  } catch (err) {
    console.error("Redis or DB error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports.searchContact = asyncHandler(async (req, res) => {
  const userId = req.user._id; // from JWT middleware
  const query = req.query.query?.trim();
  console.log("query", query);

  if (!query) {
    const contacts = await Contact.find({ userId });
    console.log(contacts);
    return res.json(contacts);
  }

  const regex = new RegExp(query, "i"); // case-insensitive

  const contacts = await Contact.find({
    userId,
    $or: [{ name: regex }, { phone: regex }],
  }).limit(10); // limit result to 10

  if (!contacts) {
    return res.json({ error: "No contacts found" });
  }

  return res.json(contacts);
});
