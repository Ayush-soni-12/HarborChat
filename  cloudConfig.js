const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name : process.env.CLOUD_NAME,
    api_key : process.env.CLOUD_API_KEY,
    api_secret :process.env.CLOUD_API_SECRET

})

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
      return {
          folder: req.cloudinaryFolder || "HarborChat", // Folder name in Cloudinary
          allowed_formats: ["jpeg", "png", "jpg"], // Allowed file formats
          public_id: `${Date.now()}-${file.originalname}`, // Optional: Custom public ID
      };
  },
});


  module.exports = {
    cloudinary,
    storage
  }