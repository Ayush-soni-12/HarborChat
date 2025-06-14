const asyncHandler = require("../middlewares/asyncHandler");
const Contact = require("../modals/contactModal")
const User = require("../modals/UserModal")

module.exports.index = asyncHandler(async(req,res)=>{
    return res.render('home.ejs')
});
module.exports.chat = asyncHandler(async(req,res)=>{
      try {
    const contacts = await Contact.find({ userId: req.user._id });
    res.render("chatss", { contacts: contacts || [] }); // ✅ Ensure contacts is at least an empty array
  } catch (err) {
    console.error(err);
    res.render("chatss", { contacts: [] }); // ✅ Also fallback on error
  }
})

module.exports.contact = asyncHandler(async(req,res)=>{
    try {
    let { name, phone } = req.body;
    console.log(req.body)

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: "Name and phone are required." });
    }


       phone = phone.trim(); // Remove any whitespace first

if (!phone.startsWith("+91")) {
    phone = "+91" + phone;
}
        console.log(req.body)

    // Check if contact is a registered user
    const registeredUser = await User.findOne({ phoneNo:phone });

    if (!registeredUser) {
      return res.status(404).json({ success: false, message: "Contact is not registered on the platform." });
    }

    // Check if this contact already exists for the current user
    const existingContact = await Contact.findOne({ userId: req.user._id, phone });
    if (existingContact) {
      return res.status(409).json({ success: false, message: "Contact already exists." });
    }

    // Save new contact
    const contact = new Contact({
      name,
      phone,
      userId: req.user._id,
    });
    console.log(contact)

    await contact.save();

    res.status(201).json({ success: true, contact });
  } catch (err) {
    console.error("Error adding contact:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
})