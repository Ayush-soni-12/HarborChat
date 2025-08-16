export async function uploadToCloudinary(blob) {
  // Step 1: Get secure signature from your server
  const signatureRes = await fetch("/auth/cloudinary/generateImageUploadSignature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: "harborchat/images" }),
  });

  const { signature, timestamp, apiKey, cloudName, folder } = await signatureRes.json();

  // Step 2: Upload encrypted file using signed params
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const cloudinaryRes = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!cloudinaryRes.ok) {
    throw new Error("❌ Failed to upload file to Cloudinary");
  }

  return await cloudinaryRes.json(); // contains secure_url, public_id, etc.
}


export async function AudiouploadToCloudinary(blob) {
  // Step 1: Get secure signature from your server
  const signatureRes = await fetch("/auth/cloudinary/generateAudioUploadSignature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: "harborchat/audio" }),
  });

  const { signature, timestamp, apiKey, cloudName, folder } = await signatureRes.json();

  // Step 2: Upload encrypted file using signed params
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const cloudinaryRes = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!cloudinaryRes.ok) {
    throw new Error("❌ Failed to upload file to Cloudinary");
  }

  return await cloudinaryRes.json(); // contains secure_url, public_id, etc.
}
