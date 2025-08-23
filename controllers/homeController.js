import asyncHandler from "../middlewares/asyncHandler.js";
import Contact from "../modals/contactModal.js";
import User from "../modals/UserModal.js";
import { cloudinary } from "../ cloudConfig.js"; // fixed import path
import { sendMail } from "../Helpers/mailer.js";
import { getGeminiResponse } from "../Helpers/getLocalLLMResponse.js"; // fixed import path
import Message from "../modals/Message.js";
import client from "../redisClient.js";
import streamifier from "streamifier";
import { translateText } from "../Helpers/translate.js"; // fixed import path
import { sendMessageToKafka } from "../kafkaProducer.js"; // fixed import path
import { getConversationKey } from "../Helpers/chat.js";
import UserChat from "../modals/userChat.js";
import Group from "../modals/GroupSchema.js"; // fixed import path
import GroupMessage from "../modals/GroupMessage.js";

// const generateToken = require"../middlewares/generateToken";
import jwt from  "jsonwebtoken";

export const  index = asyncHandler(async (req, res) => {
  return res.render("home.ejs");
});
export const chat = asyncHandler(async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user._id })
      .sort({ messageTime: -1 }) //  Sort latest messageTime first
      .populate("contactId", "about");
    const contactsWithLastMsg = await Promise.all(
      contacts.map(async (contact) => {
        const lastMsg = await Message.findOne({
          $or: [
            { senderId: req.user._id, receiverId: contact.contactId._id },
            { senderId: contact.contactId._id, receiverId: req.user._id },
          ],
        })
          .sort({ timestamp: -1 })
          .lean();

        // Attach lastMessage (or empty string if none)
        return {
          ...contact.toObject(),
          lastMessage: lastMsg ? lastMsg.message : "",
        };
      })
    );

    // Groups where user is a member
    const groups = await Group.find({ "members.user": req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const groupsWithLastMsg = await Promise.all(
      groups.map(async (group) => {
        const lastMsg = await GroupMessage.findOne({ groupId: group._id })
          .sort({ timestamp: -1 })
          .lean();

        return {
          ...group,
          lastMessage: lastMsg ? lastMsg.message : "",
        };
      })
    );

    res.render("chatss", {
      contacts: contactsWithLastMsg,
      groups: groupsWithLastMsg,
    });
  } catch (err) {
    console.error(err);
    
    res.render("chatss", { contacts: [], groups: [] });
  }
});
export const contact = asyncHandler(async (req, res) => {
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

export const setting = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.send("User not exist");
  }
  const userDetail = req.user;
  // console.log(userDetail)
  return res.render("setting.ejs", { userDetail });
});

export const Status = asyncHandler(async (req, res) => {
  return res.render("status.ejs");
});
export const profile = asyncHandler(async (req, res) => {
  return res.render("profile.ejs");
});
export const updateProfile = asyncHandler(async (req, res) => {
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

export const updateEmail = asyncHandler(async (req, res) => {
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

export const verifyEmailChange = asyncHandler(async (req, res) => {
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

export const me = asyncHandler(async (req, res) => {
  const user = req.user;
  console.log(req.user);
  return res.json({ user });
});
export const personalChat = asyncHandler(async (req, res) => {
  try {
    const senderId = req.user._id.toString(); // from JWT
    const receiverId = req.params.receiverId;

    const ids = [senderId, receiverId].sort();
    const baseKey = `chat:${ids[0]}:${ids[1]}`;

    const { skip = 0, limit = 30 } = req.query;

    // 🔑 Redis keys
    const normalKey = `${baseKey}:normal`;
    const secretKey = `${baseKey}:secret`;

        // 🔹 Get lastClearedAt for this user
    const conversationKey = getConversationKey(senderId, receiverId);
    const meta = await UserChat.findOne({ userId: senderId, conversationKey });
    const lastClearedAt = meta?.lastClearedAt || new Date(0);

    let messages = [];

    // ✅ 1. If first page, try Redis cache
    if (Number(skip) === 0) {
      const [normalCached, secretCached] = await Promise.all([
        client.get(normalKey),
        client.get(secretKey),
      ]);

      if (normalCached || secretCached) {
        console.log("✅ Redis cache hit");

        const normalMessages = normalCached ? JSON.parse(normalCached) : [];
        const secretMessages = secretCached ? JSON.parse(secretCached) : [];

        // Merge both and sort by timestamp (oldest to newest)
        messages = [...normalMessages, ...secretMessages]
         .filter(m => new Date(m.timestamp) > lastClearedAt)
        .sort( (a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        return res.json({ messages });
      }
    }

    // ❌ 2. Redis miss → Load from MongoDB
    const mongoMessages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
           timestamp: { $gt: lastClearedAt }
    })
      .sort({ timestamp: -1 }) // newest first
      .skip(Number(skip))
      .limit(Number(limit));

    messages = mongoMessages.reverse(); // oldest first for UI

    console.log("📦 MongoDB hit");

    // ✅ 3. Cache only the first page of normal messages
    if (Number(skip) === 0) {
      const normalMessagesToCache = messages.filter((msg) => !msg.isSecretChat);
      if (normalMessagesToCache.length > 0) {
        await client.set(normalKey, JSON.stringify(normalMessagesToCache), { EX: 300 });
        console.log("💾 Cached normal messages to Redis");
      }
    }

    return res.json({ messages });
  } catch (err) {
    console.error("❌ Redis or DB error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export const searchContact = asyncHandler(async (req, res) => {
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

export const audioMessage = asyncHandler(async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }
    console.log("Uploaded mimetype:", req.file.mimetype);

    console.log("Audio uploaded to Cloudinary:", req.file);

    // This URL now points to encrypted binary stored on Cloudinary
    res.json({
      encryptedAudioUrl: req.file.path, // Not directly playable
      senderId,
      receiverId
    });// <-- Cloudinary secure URL
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export const whisperBotMessage = asyncHandler(async( req,res)=>{

    try {
    const { prompt } = req.body;

    const aiReply = await getGeminiResponse(prompt); // Or your own function

        if (!aiReply) {
      return res.status(500).json({ error: "Gemini failed to respond." });
    }

    res.json({ reply: aiReply });
  } catch (err) {
    console.error("❌ WhisperBot error:", err);
    res.status(500).json({ error: "WhisperBot failed" });
  }

})


export const translateChat = asyncHandler(async (req, res) => {
  const { text, targetLang } = req.body;
  const translated = await translateText(text, targetLang);
  
  if (translated) {
    res.json({ translated });
  } else {
    res.status(500).json({ error: "Translation failed." });
  }
});

export const pinMessage = asyncHandler(async (req, res) => {
  try {
    const { messageId, pin } = req.body;

    const result = await Message.findOneAndUpdate(
      { _id: messageId },
      { pinned: pin },
      { new: true }
    );

    // 🔁 If message already in DB
    if (result) {
      const senderId = result.senderId.toString();
      const receiverId = result.receiverId.toString();
      const ids = [senderId, receiverId].sort();
      const baseKey = `chat:${ids[0]}:${ids[1]}`;
      const normalKey = `${baseKey}:normal`;
      const secretKey = `${baseKey}:secret`;

      for (const key of [normalKey, secretKey]) {
        const cached = await client.get(key);
        if (cached) {
          let messages = JSON.parse(cached);
          let updated = false;
          messages = messages.map((msg) => {
            if (msg._id === messageId) {
              updated = true;
              return { ...msg, pinned: pin };
            }
            return msg;
          });
          if (updated) {
            await client.set(key, JSON.stringify(messages), { EX: 300 });
          }
        }
      }

      return res.json({ success: true, message: 'Message pinned in DB', data: result });
    }

    // 🕐 If message not yet in DB, store in Redis as pending
if (!result) return res.status(404).json({ error: "Message not found" });


  } catch (err) {
    console.error('Error pinning message:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export const unPinMessage = asyncHandler(async(req,res)=>{
   const { id } = req.params;
  const { pinned } = req.body;

  try {
    const updatedMessage = await Message.findOneAndUpdate(
      { _id: id },
      { pinned: !!pinned },
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

     // 2. Update in Redis (if cached)
    const senderId = updatedMessage.senderId.toString();
    const receiverId = updatedMessage.receiverId.toString();
    const ids = [senderId, receiverId].sort();
    const baseKey = `chat:${ids[0]}:${ids[1]}`;
    const normalKey = `${baseKey}:normal`;
    const secretKey = `${baseKey}:secret`;

    for (const key of [normalKey, secretKey]) {
      const cached = await client.get(key);
      if (cached) {
        let messages = JSON.parse(cached);
        let updated = false;
        messages = messages.map(msg => {
          if (msg._id === id) {
            updated = true;
            return { ...msg, pinned: !!pinned };
          }
          return msg;
        });
        if (updated) {
          await client.set(key, JSON.stringify(messages), { EX: 300 });
        }
      }
    }

    res.json({ success: true, data: updatedMessage });
  } catch (err) {
    console.error("Error updating pin status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
})

export const updateTheme = asyncHandler(async(req,res)=>{
    try {
    const { theme, background1,background2,sentText1,sentText2,recievedText1,recievedText2  } = req.body;

    const update = {
      theme,
    };

    if (theme === 'custom') {
      update.customTheme = {
        background1,
        background2,
        sentText1,
        sentText2,
        recievedText1,
        recievedText2
      };
    }

    await User.findByIdAndUpdate(req.user.id, update);
    res.redirect('/chat/setting');
  } catch (err) {
    console.error('Error updating theme:', err);
    res.status(500).send('Server error');
  }
})

export const deleteChat = asyncHandler(async(req,res)=>{
  try {
    const receiverId = req.body.targetUserId // user you're chatting with
    const senderId = req.user._id;
    const userId = req.user._id


    const conversationKey = getConversationKey(senderId, receiverId);

    await UserChat.updateOne(
      { userId, conversationKey },
      { $set: { lastClearedAt: new Date() } },
      { upsert: true }
    );

    const ids = [senderId, receiverId].sort();
    const baseKey = `chat:${ids[0]}:${ids[1]}`;

    await Promise.all([
      client.del(`${baseKey}:normal`),
      client.del(`${baseKey}:secret`)
    ]);


    res.json({ success: true, message: "Chat cleared from your side." });
  } catch (error) {
    console.error("Error clearing chat:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
})

export const fetchGroups  = asyncHandler(async(req,res)=>{
  try {
    const userId = req.user._id;

    const groups = await Group.find({
      "members.user": userId,
    })
      .populate("members.user", "name avatar") // optional: fetch user data
      .sort({ createdAt: -1 });

    return res.status(200).json({ groups });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
})

export const  GroupInfo = asyncHandler(async(req,res)=>{

    const group = await Group.findById(req.params.id)
    .populate("members", "name avatar")
    .select("name members createdAt");

  if (!group) return res.status(404).json({ error: "Group not found" });
  console.log(group);
   return res.json(group);
})

export const createGroup = asyncHandler(async(req,res)=>{

   try {
    const { name, description, avatar, members = [] } = req.body;

    // Ensure group name
    if (!name) return res.status(400).json({ error: "Group name is required" });

    // Initialize members: include creator as owner
    const allMembers = [
      { user: req.user._id, role: "owner" },
      ...members.map((id) => ({ user: id, role: "member" })),
    ];

    // Remove duplicates (optional)
    // const uniqueMembers = Array.from(
    //   new Map(allMembers.map((m) => [m.user.toString(), m])).values()
    // );

    const group = new Group({
      name,
      description,
      avatar,
      owner: req.user._id,
      members: allMembers,
    });

    await group.save();
    return res.status(201).json({ message: "Group created", group });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }

});