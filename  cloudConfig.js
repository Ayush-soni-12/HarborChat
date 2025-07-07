// ES Modules (with "type": "module" in package.json)
import { v2 as cloudinary } from 'cloudinary';

import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
    cloud_name : process.env.CLOUD_NAME,
    api_key : process.env.CLOUD_API_KEY,
    api_secret :process.env.CLOUD_API_SECRET

})

function getResourceType(mimetype) {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/") || mimetype.startsWith("audio/")) return "video";
  return "raw";
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const resource_type = getResourceType(file.mimetype);

    return {
      folder: req.cloudinaryFolder || "HarborChat",
      resource_type, // <-- Important for audio/video
      allowed_formats: ["jpeg", "png", "jpg", "mp3", "wav", "webm", "mp4", "mov", "ogg"], // ✅ add "ogg"
      public_id: `${Date.now()}-${file.originalname}`
    };
  }
});


  export  {
    cloudinary,
    storage
  }